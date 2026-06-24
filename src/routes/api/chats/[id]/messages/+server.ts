import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { ensureChat, getChat, upsertChatMessage } from '$lib/server/db/chat-service';
import { errors } from '$lib/server/errors';
import type { MessageContent } from '$lib/types/chat';

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const body = (await request.json()) as {
		id?: string;
		role?: 'user' | 'assistant';
		contents?: MessageContent[];
		title?: string;
	};
	if (!body.id || !body.role || !body.contents) return errors.badRequest('id, role, contents は必須です。');

	const db = createDb(platform.env.DB);

	const existing = await getChat(db, params.id);
	if (existing && existing.accountId && existing.accountId !== locals.account!.id) return errors.forbidden();

	await ensureChat(db, { id: params.id, title: body.title, accountId: locals.account!.id });
	await upsertChatMessage(db, { id: body.id, chatId: params.id, role: body.role, contents: body.contents });

	return json({ ok: true });
};
