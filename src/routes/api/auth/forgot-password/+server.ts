import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { createDb } from '$lib/server/db';
import { getAccountByEmailWithPassword } from '$lib/server/db/account-service';
import { createPasswordResetToken } from '$lib/server/auth/password-reset';
import { checkRateLimit } from '$lib/server/rate-limit';
import { getEmailSetupFromEnv, sendEmail } from '$lib/server/email';
import { errors } from '$lib/server/errors';

const forgotPasswordInputSchema = z.object({
	email: z.string().email()
});

export const POST: RequestHandler = async ({ request, platform, url }) => {
	if (!platform?.env?.DB || !platform.env.KV) return errors.serviceUnavailable('利用できません');

	const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
	const rl = await checkRateLimit(platform.env.KV, 'forgot-password', ip, { windowSeconds: 3600, maxRequests: 5 });
	if (!rl.allowed) return errors.tooManyRequests(rl.retryAfter ?? 3600);

	const data = forgotPasswordInputSchema.parse(await request.json());

	const setup = getEmailSetupFromEnv(platform.env);
	if (!setup) return errors.serviceUnavailable('パスワードリセット機能は現在利用できません');

	const db = createDb(platform.env.DB);
	const account = await getAccountByEmailWithPassword(db, data.email);
	if (account) {
		const token = await createPasswordResetToken(platform.env.KV, account.id);
		const resetUrl = `${url.origin}/signin/reset-password?token=${token}`;
		await sendEmail(setup.providerConfig, {
			from: setup.from,
			fromName: setup.fromName,
			to: data.email,
			subject: '【Midleton】パスワード再設定のご案内',
			text: `パスワード再設定のご案内\n\n以下のリンクから新しいパスワードを設定してください。\n${resetUrl}\n\nこのリンクの有効期限は1時間です。\n\nこのメールに心当たりがない場合は、このメールを無視してください。`
		});
	}

	return json({ ok: true });
};
