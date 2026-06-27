import { redirect, type Handle } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { getAccount } from '$lib/server/db/account-service';
import { getSessionAccountId, SESSION_COOKIE_NAME } from '$lib/server/auth/session';
import { errors } from '$lib/server/errors';

const PUBLIC_PATHS = new Set(['/signin', '/signin/forgot-password', '/signin/reset-password']);
const PUBLIC_API_PREFIXES = ['/api/auth/'];

// 認証情報・権限変更を含むページ・APIはadmin権限のみアクセス可能
const ADMIN_ONLY_PREFIXES = [
	'/accounts',
	'/settings/integrations',
	'/settings/email',
	'/settings/ai',
	'/api/accounts',
	'/api/integrations',
	'/api/email/settings',
	'/api/ai/settings',
	'/api/documents/test'
];

function isPublicPath(pathname: string): boolean {
	if (PUBLIC_PATHS.has(pathname)) return true;
	return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminOnlyPath(pathname: string): boolean {
	return ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export const handle: Handle = async ({ event, resolve }) => {
	const { platform, url, cookies } = event;

	event.locals.account = null;

	if (platform?.env?.DB && platform.env.KV) {
		const sessionId = cookies.get(SESSION_COOKIE_NAME);
		if (sessionId) {
			const accountId = await getSessionAccountId(platform.env.KV, sessionId);
			if (accountId) {
				const db = createDb(platform.env.DB);
				event.locals.account = await getAccount(db, accountId);
			}
		}
	}

	if (!event.locals.account && !isPublicPath(url.pathname)) {
		if (url.pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: '認証が必要です', code: 'UNAUTHORIZED' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		const redirectTo = `${url.pathname}${url.search}`;
		throw redirect(303, `/signin?redirect=${encodeURIComponent(redirectTo)}`);
	}

	if (event.locals.account && url.pathname === '/signin') {
		throw redirect(303, '/');
	}

	if (event.locals.account?.permission !== 'admin' && isAdminOnlyPath(url.pathname)) {
		if (url.pathname.startsWith('/api/')) {
			return errors.forbidden();
		}
		throw redirect(303, '/');
	}

	return resolve(event);
};
