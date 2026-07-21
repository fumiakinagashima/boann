import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { reorderTables } from '$lib/server/db/table-service';
import { reorderWorkflows } from '$lib/server/db/workflow-service';

// アプリ設定画面のドラッグ&ドロップ並べ替え。kind ごとに対象テーブルの sortOrder を振り直す。
export const POST: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const body = (await request.json()) as { kind?: string; orderedIds?: string[] };
	const orderedIds = body.orderedIds ?? [];
	if (!Array.isArray(orderedIds)) return json({ error: 'orderedIds must be an array' }, { status: 400 });

	switch (body.kind) {
		case 'tables':
			await reorderTables(db, params.id, orderedIds);
			break;
		case 'workflows':
			await reorderWorkflows(db, params.id, orderedIds);
			break;
		default:
			return json({ error: 'invalid kind' }, { status: 400 });
	}
	return json({ ok: true });
};
