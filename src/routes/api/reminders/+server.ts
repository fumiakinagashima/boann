import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { createReminderRow } from '$lib/server/db/reminder-service';
import { parseJstDatetime } from '$lib/datetime';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	try {
		const body = (await request.json()) as { remind_at?: string; content?: string; channels?: string };
		const channels = (body.channels ?? '').split(',').map((c) => c.trim()).filter(Boolean);
		if (!body.remind_at || !body.content?.trim() || channels.length === 0) {
			return json({ error: '入力が不正です' }, { status: 400 });
		}
		const row = await createReminderRow(db, {
			remindAt: parseJstDatetime(body.remind_at),
			content: body.content.trim(),
			channels,
			accountId: locals.account!.id
		});
		return json(row);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
