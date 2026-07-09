import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { updateAppMeta, deleteApp, getAppById } from '$lib/server/db/table-service';
import { errors } from '$lib/server/errors';
import type { AccountRow } from '$lib/server/db/account-service';

// 編集・削除は作成者本人または管理者のみ。accountId が null（移行前データ等）のアプリは
// 所有者不明の共有アプリとして誰でも編集・削除できる（workflows 等の既存の規約に合わせる）。
function canManage(app: { accountId: string | null }, account: AccountRow | null): boolean {
	if (!app.accountId) return true;
	if (account?.permission === 'admin') return true;
	return app.accountId === account?.id;
}

export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) return errors.notFound('アプリが見つかりません');
	if (!canManage(app, locals.account)) return errors.forbidden();
	const body = await request.json() as { label?: string; icon?: string };
	if (body.label !== undefined || body.icon !== undefined) {
		await updateAppMeta(db, params.id, { label: body.label, icon: body.icon });
	}
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, params.id);
	if (!app) return errors.notFound('アプリが見つかりません');
	if (!canManage(app, locals.account)) return errors.forbidden();
	await deleteApp(db, params.id);
	return new Response(null, { status: 204 });
};
