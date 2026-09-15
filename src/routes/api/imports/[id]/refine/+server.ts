import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';
import { getAiModel } from '$lib/server/ai/settings';
import { refineImportPlan } from '$lib/server/ai/import-plan';
import { getImportJob, updateImportJob, type ImportChatMessage } from '$lib/server/db/import-job-service';
import type { RequestHandler } from './$types';

// "Request a revision via chat" on the plan proposal page. Updates the current plan based on the user's request (synchronous).
export const POST: RequestHandler = async ({ request, params, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('D1 database is not configured');

	const { message } = (await request.json()) as { message?: string };
	const text = message?.trim();
	if (!text) return errors.badRequest('Message is empty');

	const db = createDb(platform.env.DB);
	const job = await getImportJob(db, params.id);
	if (!job) return errors.notFound('Job not found');
	if (job.accountId !== locals.account?.id) return errors.forbidden();
	if (!job.plan) return errors.badRequest('The plan has not been generated yet');

	const mockMode = platform.env.MOCK_AI === 'true' || env.MOCK_AI === 'true';

	let newPlan = job.plan;
	let reply = 'The plan has been updated.';
	try {
		if (mockMode) {
			reply = '(Mock) Revision request received. It will be reflected in the plan in the real environment.';
		} else {
			const apiKey = platform.env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
			if (!apiKey) return errors.serviceUnavailable('ANTHROPIC_API_KEY is not set');
			newPlan = await refineImportPlan({
				apiKey,
				model: await getAiModel(db),
				currentPlan: job.plan,
				content: job.content,
				message: text,
				history: job.chat
			});
		}
	} catch (e) {
		return errors.internal(e);
	}

	const chat: ImportChatMessage[] = [
		...job.chat,
		{ role: 'user', text },
		{ role: 'assistant', text: reply }
	];
	await updateImportJob(db, job.id, { plan: newPlan, chat });

	return json({ plan: newPlan, chat });
};
