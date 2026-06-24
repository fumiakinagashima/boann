import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { createDb } from '$lib/server/db';
import { AI_MODEL_OPTIONS, getAiModel, setAiModel } from '$lib/server/ai/settings';

const updateAiSettingsSchema = z.object({
	model: z.enum(AI_MODEL_OPTIONS.map((o) => o.value) as [string, ...string[]])
});

export const GET: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB unavailable' }, { status: 500 });
	const db = createDb(platform.env.DB);
	return json({ model: await getAiModel(db), options: AI_MODEL_OPTIONS });
};

export const PUT: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB unavailable' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const data = updateAiSettingsSchema.parse(await request.json());
	await setAiModel(db, data.model);
	return json({ success: true });
};
