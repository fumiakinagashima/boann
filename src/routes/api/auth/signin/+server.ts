import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { createDb } from '$lib/server/db';
import { getAccountByEmailWithPassword, updateAccount } from '$lib/server/db/account-service';
import { verifyPassword } from '$lib/server/auth/password';
import { createSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '$lib/server/auth/session';
import { checkRateLimit } from '$lib/server/rate-limit';
import { errors } from '$lib/server/errors';

const signinSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1)
});

export const POST: RequestHandler = async ({ request, platform, cookies, url }) => {
	if (!platform?.env?.DB || !platform.env.KV) return errors.serviceUnavailable('利用できません');

	const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
	const rl = await checkRateLimit(platform.env.KV, 'signin', ip, { windowSeconds: 900, maxRequests: 10 });
	if (!rl.allowed) return errors.tooManyRequests(rl.retryAfter ?? 900);

	const data = signinSchema.parse(await request.json());
	const db = createDb(platform.env.DB);

	const account = await getAccountByEmailWithPassword(db, data.email);
	if (!account || !account.passwordHash) {
		return errors.badRequest('メールアドレスまたはパスワードが正しくありません');
	}

	const result = await verifyPassword(data.password, account.passwordHash);
	if (!result.valid) {
		return errors.badRequest('メールアドレスまたはパスワードが正しくありません');
	}

	if (result.rehash) {
		await updateAccount(db, account.id, { passwordHash: result.rehash });
	}

	const sessionId = await createSession(platform.env.KV, account.id);
	cookies.set(SESSION_COOKIE_NAME, sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: SESSION_TTL_SECONDS
	});

	return json({ id: account.id, name: account.name, permission: account.permission });
};
