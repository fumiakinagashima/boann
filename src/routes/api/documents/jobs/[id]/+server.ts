import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errors } from '$lib/server/errors';
import type { LinkContent } from '$lib/types/chat';

type DocumentJobStatus =
	| { status: 'pending' }
	| { status: 'done'; result: LinkContent }
	| { status: 'error'; error: string };

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.KV) return errors.serviceUnavailable('KV is not configured');

	const raw = await platform.env.KV.get(`docjob:${params.id}`);
	if (!raw) return errors.notFound('Job not found');

	const job = JSON.parse(raw) as DocumentJobStatus;
	return json(job);
};
