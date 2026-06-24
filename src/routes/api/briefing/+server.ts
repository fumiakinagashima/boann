import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createDb } from '$lib/server/db';
import { getCachedBriefing, computeBriefing } from '$lib/server/ai/briefing';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const db = createDb(platform.env.DB);
	const accountId = locals.account?.id ?? null;

	const body = await request.json().catch(() => ({})) as { force?: boolean };
	const force = body.force === true;

	// キャッシュ確認（強制再生成でない場合）
	if (!force) {
		const cached = await getCachedBriefing(db, accountId);
		if (cached) return json({ contents: cached, cached: true });
	}

	const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY が設定されていません。' }, { status: 500 });

	try {
		const contents = await computeBriefing(db, accountId, apiKey);
		return json({ contents, cached: false });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: `AIエラー: ${msg}` }, { status: 500 });
	}
};
