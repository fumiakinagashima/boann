import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { deleteReminder, getReminder, updateReminder } from '$lib/server/db/reminder-service';
import { parseJstDatetime } from '$lib/datetime';
import { errors } from '$lib/server/errors';

export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);

	const reminder = await getReminder(db, params.id);
	if (!reminder) return errors.notFound();
	if (reminder.accountId && reminder.accountId !== locals.account!.id) return errors.forbidden();
	if (reminder.status !== 'pending') return json({ error: '送信済みのリマインダーは編集できません。' }, { status: 400 });

	try {
		const body = (await request.json()) as { remind_at?: string; content?: string; channels?: string };
		const channels = (body.channels ?? '').split(',').map((c) => c.trim()).filter(Boolean);
		if (!body.remind_at || !body.content?.trim() || channels.length === 0) {
			return json({ error: '入力が不正です' }, { status: 400 });
		}
		const row = await updateReminder(db, params.id, {
			remindAt: parseJstDatetime(body.remind_at),
			content: body.content.trim(),
			channels
		});
		return json(row);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);

	const reminder = await getReminder(db, params.id);
	if (!reminder) return errors.notFound();
	if (reminder.accountId && reminder.accountId !== locals.account!.id) return errors.forbidden();

	await deleteReminder(db, params.id);
	return new Response(null, { status: 204 });
};
