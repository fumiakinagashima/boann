import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';
import { getAiModel } from '$lib/server/ai/settings';
import { refineImportPlan } from '$lib/server/ai/import-plan';
import { getImportJob, updateImportJob, type ImportChatMessage } from '$lib/server/db/import-job-service';
import type { RequestHandler } from './$types';

// プラン提案ページでの「チャットで修正依頼」。現在のプランをユーザーの依頼で更新する（同期）。
export const POST: RequestHandler = async ({ request, params, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('D1データベースが設定されていません');

	const { message } = (await request.json()) as { message?: string };
	const text = message?.trim();
	if (!text) return errors.badRequest('メッセージが空です');

	const db = createDb(platform.env.DB);
	const job = await getImportJob(db, params.id);
	if (!job) return errors.notFound('ジョブが見つかりません');
	if (job.accountId !== locals.account?.id) return errors.forbidden();
	if (!job.plan) return errors.badRequest('プランがまだ生成されていません');

	const mockMode = platform.env.MOCK_AI === 'true' || env.MOCK_AI === 'true';

	let newPlan = job.plan;
	let reply = 'プランを更新しました。';
	try {
		if (mockMode) {
			reply = '（モック）修正を受け付けました。実環境ではプランに反映されます。';
		} else {
			const apiKey = platform.env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
			if (!apiKey) return errors.serviceUnavailable('ANTHROPIC_API_KEY が設定されていません');
			newPlan = await refineImportPlan({
				apiKey,
				model: await getAiModel(db),
				currentPlan: job.plan,
				content: job.content,
				message: text,
				history: job.chat
			});
		}
	} catch (e) {
		return errors.internal(e);
	}

	const chat: ImportChatMessage[] = [
		...job.chat,
		{ role: 'user', text },
		{ role: 'assistant', text: reply }
	];
	await updateImportJob(db, job.id, { plan: newPlan, chat });

	return json({ plan: newPlan, chat });
};
