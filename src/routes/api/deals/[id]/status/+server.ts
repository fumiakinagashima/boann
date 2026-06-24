import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { dispatchTool } from '$lib/server/mcp';
import { errors } from '$lib/server/errors';

const VALID_STATUSES = new Set(['open', 'won', 'lost']);

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('D1データベースが設定されていません');

	const { status } = (await request.json()) as { status?: string };
	if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
		return errors.badRequest('不正なステータスです');
	}

	const db = createDb(platform.env.DB);
	try {
		await dispatchTool(db, 'update_deal', { id: params.id, status });
		return json({ ok: true });
	} catch (e) {
		return errors.internal(e);
	}
};
