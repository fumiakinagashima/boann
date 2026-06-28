import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';
import { getAiModel } from '$lib/server/ai/settings';
import { generateImportPlan, mockImportPlan } from '$lib/server/ai/import-plan';
import type { RequestHandler } from './$types';

// 取り込んだファイル内容からアプリ構造のプランを生成する（確定はしない）。
export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('D1データベースが設定されていません');

	const { content, filename } = (await request.json()) as { content?: string; filename?: string };
	if (!content?.trim()) return errors.badRequest('ファイル内容が空です');

	const mockMode = platform.env.MOCK_AI === 'true' || env.MOCK_AI === 'true';
	if (mockMode) {
		return json({ plan: mockImportPlan(content) });
	}

	const apiKey = platform.env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) return errors.serviceUnavailable('ANTHROPIC_API_KEY が設定されていません');

	const db = createDb(platform.env.DB);
	const model = await getAiModel(db);

	try {
		const plan = await generateImportPlan({ apiKey, model, content, filename: filename ?? 'untitled' });
		return json({ plan });
	} catch (e) {
		return errors.internal(e);
	}
};
