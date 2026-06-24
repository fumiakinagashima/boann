import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { AI_MODEL_OPTIONS, getAiModel } from '$lib/server/ai/settings';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const db = createDb(platform!.env.DB);
	return {
		account: locals.account!,
		model: await getAiModel(db),
		options: AI_MODEL_OPTIONS
	};
};
