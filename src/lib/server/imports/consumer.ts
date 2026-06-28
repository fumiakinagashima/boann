import type { Db } from '$lib/server/db';
import { applyImportPlan } from '$lib/server/db/import-apply';
import { getImportJob, updateImportJob } from '$lib/server/db/import-job-service';
import { createNotification } from '$lib/server/db/notification-service';
import type { ImportJobMessage } from './types';

// Queue consumer のジョブ処理本体。worker.ts の queue ハンドラから呼ぶ。
// applyImportPlan は AI を使わない決定的処理。失敗時は app ごとロールバックされる。
// at-least-once 配信を考慮し、既に done のジョブは再処理しない（冪等）。
export async function processImportJob(db: Db, message: ImportJobMessage): Promise<void> {
	const { jobId, accountId, plan } = message;

	const existing = await getImportJob(db, jobId);
	if (existing?.status === 'done') return; // 重複配信はスキップ

	await updateImportJob(db, jobId, { status: 'processing' });

	try {
		const { appId } = await applyImportPlan(db, plan);
		await updateImportJob(db, jobId, { status: 'done', appId, error: null });
		await createNotification(db, {
			type: 'import',
			title: 'アプリを作成しました',
			body: `「${plan.app.label}」を作成しました。`,
			seedContent: [
				{
					type: 'link',
					label: `${plan.app.label} を開く`,
					href: `/apps/${appId}`,
					description: 'ファイルから作成したアプリ'
				}
			],
			accountId
		});
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		await updateImportJob(db, jobId, { status: 'error', error });
		await createNotification(db, {
			type: 'import',
			title: 'アプリの作成に失敗しました',
			body: `「${plan.app.label}」の作成中にエラーが発生しました: ${error}`,
			seedContent: [],
			accountId
		});
	}
}
