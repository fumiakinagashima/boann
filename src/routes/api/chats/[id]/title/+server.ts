import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { createDb } from '$lib/server/db';
import { getChat, updateChatTitle } from '$lib/server/db/chat-service';
import { generateChatTitle } from '$lib/server/ai/chat-title';
import { checkRateLimit } from '$lib/server/rate-limit';
import { errors } from '$lib/server/errors';

function truncateTitle(message: string): string {
	const t = message.trim().replace(/\s+/g, ' ');
	return t.length > 20 ? t.slice(0, 20) + '…' : t;
}

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });

	const mockMode = platform?.env?.MOCK_AI === 'true' || env.MOCK_AI === 'true';

	const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
	const rl = await checkRateLimit(platform.env.KV, 'chat', ip);
	if (!rl.allowed) return errors.tooManyRequests(rl.retryAfter ?? 60);

	const body = (await request.json()) as { message?: string };
	const message = body.message?.trim() ?? '';
	if (!message) return errors.badRequest('message is empty.');

	const db = createDb(platform.env.DB);

	const chat = await getChat(db, params.id);
	if (chat && chat.accountId && chat.accountId !== locals.account!.id) return errors.forbidden();

	if (mockMode) {
		const title = truncateTitle(message);
		await updateChatTitle(db, params.id, title);
		return json({ title });
	}

	const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not set.' }, { status: 500 });

	try {
		const title = await generateChatTitle(apiKey, message);
		await updateChatTitle(db, params.id, title);
		return json({ title });
	} catch (e) {
		return errors.internal(e);
	}
};
