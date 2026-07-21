import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getAppById } from '$lib/server/db/table-service';
import { errors } from '$lib/server/errors';
import { canManageApp } from '$lib/server/authz';
import { getMcpTokenStatus, issueMcpToken, deleteMcpToken } from '$lib/server/mcp/auth';

export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('利用できません');
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) return errors.notFound('アプリが見つかりません');
	if (!canManageApp(app, locals.account)) return errors.forbidden();

	return json({ status: await getMcpTokenStatus(db, params.id), endpoint: `/api/apps/${params.id}/mcp` });
};

export const POST: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('利用できません');
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) return errors.notFound('アプリが見つかりません');
	if (!canManageApp(app, locals.account)) return errors.forbidden();

	const token = await issueMcpToken(db, params.id, locals.account?.id);
	return json({ token }); // 平文トークンはこのレスポンスのみに含まれる。以後は再取得不可
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('利用できません');
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) return errors.notFound('アプリが見つかりません');
	if (!canManageApp(app, locals.account)) return errors.forbidden();

	await deleteMcpToken(db, params.id);
	return new Response(null, { status: 204 });
};
