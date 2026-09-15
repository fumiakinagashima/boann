import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { errors } from '$lib/server/errors';
import {
	listExternalApiConnections,
	createExternalApiConnection,
	maskHeaders
} from '$lib/server/db/external-api-connection-service';

const createSchema = z.object({
	name: z.string().min(1),
	url: z.string().url(),
	headers: z.record(z.string(), z.string()).default({})
});

export const GET: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('Not available');
	const db = createDb(platform.env.DB);
	const rows = await listExternalApiConnections(db);
	return json(rows.map((r) => ({ ...r, headers: maskHeaders(r.headers) })));
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('Not available');
	const db = createDb(platform.env.DB);
	const data = createSchema.parse(await request.json());
	const row = await createExternalApiConnection(db, { ...data, createdBy: locals.account?.id });
	return json({ ...row, headers: maskHeaders(row.headers) }, { status: 201 });
};
