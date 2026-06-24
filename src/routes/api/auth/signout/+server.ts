import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { destroySession, SESSION_COOKIE_NAME } from '$lib/server/auth/session';

export const POST: RequestHandler = async ({ platform, cookies }) => {
	const sessionId = cookies.get(SESSION_COOKIE_NAME);
	if (sessionId && platform?.env?.KV) {
		await destroySession(platform.env.KV, sessionId);
	}
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
	return json({ ok: true });
};
