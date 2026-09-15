import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { getImportJob } from '$lib/server/db/import-job-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) throw error(500, 'D1 database is not configured');

	const db = createDb(platform.env.DB);
	const job = await getImportJob(db, params.id);
	if (!job) throw error(404, 'Job not found');
	if (job.accountId !== locals.account?.id) throw error(403, 'You do not have access permission');

	return {
		job: {
			id: job.id,
			status: job.status,
			filename: job.filename,
			plan: job.plan,
			chat: job.chat,
			appId: job.appId,
			error: job.error
		}
	};
};
