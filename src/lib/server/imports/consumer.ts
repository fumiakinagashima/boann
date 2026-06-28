import type { Db } from '$lib/server/db';
import { applyImportPlan } from '$lib/server/db/import-apply';
import { getImportJob, updateImportJob } from '$lib/server/db/import-job-service';
import { createNotification } from '$lib/server/db/notification-service';
import { generateImportPlan, mockImportPlan, importPlanSchema } from '$lib/server/ai/import-plan';
import { getAiModel } from '$lib/server/ai/settings';
import type { ImportJobMessage } from './types';

type ConsumerEnv = { ANTHROPIC_API_KEY?: string; MOCK_AI?: string };

// Queue consumer のジョブ処理本体。worker.ts の queue ハンドラから呼ぶ。
export async function processImportJob(
	db: Db,
	env: ConsumerEnv,
	message: ImportJobMessage
): Promise<void> {
	if (message.type === 'design') {
		await processDesign(db, env, message.jobId);
	} else {
		await processApply(db, message.jobId);
	}
}

// 設計: アップロード本文を AI に渡してプランを生成し、ready にする。
async function processDesign(db: Db, env: ConsumerEnv, jobId: string): Promise<void> {
	const job = await getImportJob(db, jobId);
	if (!job) return;
	if (job.status === 'ready' && job.plan) return; // 重複配信はスキップ
	if (!job.content) {
		await updateImportJob(db, jobId, { status: 'error', error: 'ファイル本文がありません' });
		return;
	}

	try {
		const filename = job.filename ?? 'untitled';
		const plan =
			env.MOCK_AI === 'true'
				? mockImportPlan(job.content)
				: await generateImportPlan({
						apiKey: env.ANTHROPIC_API_KEY ?? '',
						model: await getAiModel(db),
						content: job.content,
						filename
					});

		await updateImportJob(db, jobId, { status: 'ready', plan, error: null });
		await createNotification(db, {
			type: 'import',
			title: 'アプリの設計が完了しました',
			body: `「${plan.app.label}」のプランを確認してください。`,
			seedContent: [
				{
					type: 'link',
					label: `${plan.app.label} のプランを確認`,
					href: `/imports/${jobId}`,
					description: 'ファイルから設計したアプリのプラン'
				}
			],
			accountId: job.accountId
		});
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		await updateImportJob(db, jobId, { status: 'error', error });
		await createNotification(db, {
			type: 'import',
			title: 'アプリの設計に失敗しました',
			body: `ファイルの設計中にエラーが発生しました: ${error}`,
			seedContent: [],
			accountId: job.accountId
		});
	}
}

// apply: ドラフトのプランを決定的に反映してアプリを作成する。冪等。
async function processApply(db: Db, jobId: string): Promise<void> {
	const job = await getImportJob(db, jobId);
	if (!job) return;
	if (job.status === 'done') return; // 重複配信はスキップ

	const parsed = importPlanSchema.safeParse(job.plan);
	if (!parsed.success) {
		await updateImportJob(db, jobId, { status: 'error', error: 'プランの形式が不正です' });
		return;
	}

	try {
		const { appId } = await applyImportPlan(db, parsed.data);
		await updateImportJob(db, jobId, { status: 'done', appId, error: null });
		await createNotification(db, {
			type: 'import',
			title: 'アプリを作成しました',
			body: `「${parsed.data.app.label}」を作成しました。`,
			seedContent: [
				{
					type: 'link',
					label: `${parsed.data.app.label} を開く`,
					href: `/apps/${appId}`,
					description: 'ファイルから作成したアプリ'
				}
			],
			accountId: job.accountId
		});
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		await updateImportJob(db, jobId, { status: 'error', error });
		await createNotification(db, {
			type: 'import',
			title: 'アプリの作成に失敗しました',
			body: `「${parsed.data.app.label}」の作成中にエラーが発生しました: ${error}`,
			seedContent: [],
			accountId: job.accountId
		});
	}
}
