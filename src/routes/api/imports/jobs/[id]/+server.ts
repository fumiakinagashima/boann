import { json } from '@sveltejs/kit';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';
import { getImportJob } from '$lib/server/db/import-job-service';
import type { RequestHandler } from './$types';

// アプリ生成ジョブの進捗・結果を返す（ダイアログのポーリング用）。
export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('D1データベースが設定されていません');

	const db = createDb(platform.env.DB);
	const job = await getImportJob(db, params.id);
	if (!job) return errors.notFound('ジョブが見つかりません');
	// 自分のジョブのみ参照可
	if (job.accountId !== locals.account?.id) return errors.forbidden();

	return json({ status: job.status, appId: job.appId, error: job.error });
};
