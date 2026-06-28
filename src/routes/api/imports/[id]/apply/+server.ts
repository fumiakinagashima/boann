import { json } from '@sveltejs/kit';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';
import { getImportJob, updateImportJob } from '$lib/server/db/import-job-service';
import type { ImportJobMessage } from '$lib/server/imports/types';
import type { RequestHandler } from './$types';

// レビュー済みドラフトのプランで apply ジョブを Queue に投入する（非同期生成）。
export const POST: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('D1データベースが設定されていません');
	if (!platform.env.QUEUE) return errors.serviceUnavailable('Queue が設定されていません');

	const db = createDb(platform.env.DB);
	const job = await getImportJob(db, params.id);
	if (!job) return errors.notFound('ジョブが見つかりません');
	if (job.accountId !== locals.account?.id) return errors.forbidden();
	if (!job.plan) return errors.badRequest('プランがまだ生成されていません');

	await updateImportJob(db, job.id, { status: 'applying', error: null });
	const message: ImportJobMessage = { type: 'apply', jobId: job.id };
	await platform.env.QUEUE.send(message);

	return json({ jobId: job.id, status: 'applying' }, { status: 202 });
};
