import { json } from '@sveltejs/kit';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';
import { importPlanSchema } from '$lib/server/ai/import-plan';
import { createImportJob } from '$lib/server/db/import-job-service';
import type { ImportJobMessage } from '$lib/server/imports/types';
import type { RequestHandler } from './$types';

// レビュー済みプランを Queue に投入し、生成は非同期で行う。
// 進捗・結果は import_jobs（GET /api/imports/jobs/[id]）と通知で確認する。
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('D1データベースが設定されていません');
	if (!platform.env.QUEUE) return errors.serviceUnavailable('Queue が設定されていません');
	const accountId = locals.account?.id;
	if (!accountId) return errors.forbidden();

	const body = (await request.json()) as { plan?: unknown };
	const parsed = importPlanSchema.safeParse(body.plan);
	if (!parsed.success) return errors.badRequest('プランの形式が不正です');

	const db = createDb(platform.env.DB);
	const job = await createImportJob(db, accountId);

	const message: ImportJobMessage = { jobId: job.id, accountId, plan: parsed.data };
	await platform.env.QUEUE.send(message);

	return json({ jobId: job.id, status: job.status }, { status: 202 });
};
