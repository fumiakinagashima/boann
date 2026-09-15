import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getChat, updateChatTitle, deleteChat } from '$lib/server/db/chat-service';
import { errors } from '$lib/server/errors';

export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const body = (await request.json()) as { title?: string };
	const title = body.title?.trim();
	if (!title) return errors.badRequest('title is required.');

	const db = createDb(platform.env.DB);

	const chat = await getChat(db, params.id);
	if (!chat) return errors.notFound();
	if (chat.accountId && chat.accountId !== locals.account!.id) return errors.forbidden();

	await updateChatTitle(db, params.id, title);

	return json({ ok: true, title });
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const db = createDb(platform.env.DB);

	const chat = await getChat(db, params.id);
	if (!chat) return errors.notFound();
	if (chat.accountId && chat.accountId !== locals.account!.id) return errors.forbidden();

	await deleteChat(db, params.id);

	return json({ ok: true });
};
