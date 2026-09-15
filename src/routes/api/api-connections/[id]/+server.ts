import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { errors } from '$lib/server/errors';
import {
	updateExternalApiConnection,
	deleteExternalApiConnection,
	maskHeaders
} from '$lib/server/db/external-api-connection-service';

const updateSchema = z.object({
	name: z.string().min(1).optional(),
	url: z.string().url().optional(),
	headers: z.record(z.string(), z.string()).optional()
});

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('Not available');
	const db = createDb(platform.env.DB);
	const data = updateSchema.parse(await request.json());
	const row = await updateExternalApiConnection(db, params.id, data);
	if (!row) return errors.notFound('Connection not found');
	return json({ ...row, headers: maskHeaders(row.headers) });
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('Not available');
	const db = createDb(platform.env.DB);
	await deleteExternalApiConnection(db, params.id);
	return json({ deleted: true });
};
