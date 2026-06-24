import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getWorkflow } from '$lib/server/db/workflow-service';
import { listWorkflowRuns } from '$lib/server/db/workflow-run-service';

// ワークフローの実行ログを返す（ダイアログ編集時にクライアントから取得）。
export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const workflow = await getWorkflow(db, params.id);
	if (!workflow) return json({ error: 'Not found' }, { status: 404 });
	if (workflow.accountId && workflow.accountId !== locals.account?.id) {
		return json({ error: '権限がありません' }, { status: 403 });
	}
	const runs = await listWorkflowRuns(db, params.id);
	return json({ runs });
};
