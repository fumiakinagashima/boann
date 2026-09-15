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
	if (!platform?.env?.DB || !platform.env.KV) return errors.serviceUnavailable('Not available');

	const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
	const rl = await checkRateLimit(platform.env.KV, 'forgot-password', ip, { windowSeconds: 3600, maxRequests: 5 });
	if (!rl.allowed) return errors.tooManyRequests(rl.retryAfter ?? 3600);

	const data = forgotPasswordInputSchema.parse(await request.json());

	const setup = getEmailSetupFromEnv(platform.env);
	if (!setup) return errors.serviceUnavailable('The password reset feature is currently unavailable');

	const db = createDb(platform.env.DB);
	const account = await getAccountByEmailWithPassword(db, data.email);
	if (account) {
		const token = await createPasswordResetToken(platform.env.KV, account.id);
		const resetUrl = `${url.origin}/signin/reset-password?token=${token}`;
		await sendEmail(setup.providerConfig, {
			from: setup.from,
			fromName: setup.fromName,
			to: data.email,
			subject: '[Boann] Password Reset Instructions',
			text: `Password Reset Instructions\n\nPlease set a new password using the link below.\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request this email, please disregard it.`
		});
	}

	return json({ ok: true });
};
