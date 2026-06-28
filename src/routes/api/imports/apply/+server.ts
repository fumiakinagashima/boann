import { json } from '@sveltejs/kit';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';
import { importPlanSchema } from '$lib/server/ai/import-plan';
import { applyImportPlan } from '$lib/server/db/import-apply';
import type { RequestHandler } from './$types';

// レビュー済みプランを決定的にDBへ反映してアプリを生成する。
export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('D1データベースが設定されていません');

	const body = (await request.json()) as { plan?: unknown };
	const parsed = importPlanSchema.safeParse(body.plan);
	if (!parsed.success) return errors.badRequest('プランの形式が不正です');

	const db = createDb(platform.env.DB);
	try {
		const result = await applyImportPlan(db, parsed.data);
		return json(result, { status: 201 });
	} catch (e) {
		return errors.badRequest(e instanceof Error ? e.message : String(e));
	}
};
