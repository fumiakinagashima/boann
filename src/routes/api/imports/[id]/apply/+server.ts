import { json } from '@sveltejs/kit';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';
import { getImportJob, updateImportJob } from '$lib/server/db/import-job-service';
import type { ImportJobMessage } from '$lib/server/imports/types';
import type { RequestHandler } from './$types';

// Enqueues an apply job on the Queue using the reviewed draft's plan (asynchronous generation).
export const POST: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('D1 database is not configured');
	if (!platform.env.QUEUE) return errors.serviceUnavailable('Queue is not configured');

	const db = createDb(platform.env.DB);
	const job = await getImportJob(db, params.id);
	if (!job) return errors.notFound('Job not found');
	if (job.accountId !== locals.account?.id) return errors.forbidden();
	if (!job.plan) return errors.badRequest('The plan has not been generated yet');

	await updateImportJob(db, job.id, { status: 'applying', error: null });
	const message: ImportJobMessage = { type: 'apply', jobId: job.id };
	await platform.env.QUEUE.send(message);

	return json({ jobId: job.id, status: 'applying' }, { status: 202 });
};
