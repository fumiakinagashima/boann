import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getTableInfo } from '$lib/server/db/table-service';

// テーブルのフィールド定義（getTableInfo）のみを返す軽量エンドポイント。
// RecordDialog がフォーム・汎用詳細のフィールド定義を取得するのに使う（rows は取得しない）。
export const GET: RequestHandler = async ({ params, url, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const appId = url.searchParams.get('appId');
	if (!appId) return json({ error: 'appId is required' }, { status: 400 });
	const info = await getTableInfo(db, params.type, appId);
	if (!info) return json({ error: 'Table not found' }, { status: 404 });
	return json({ info });
};
