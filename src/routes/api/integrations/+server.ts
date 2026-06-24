import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { createDb } from '$lib/server/db';
import { integrations } from '$lib/server/db/schema';
import { maskAuthConfig } from '$lib/server/db/integration-service';
import { eq, asc } from 'drizzle-orm';

const createSchema = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	baseUrl: z.string().url(),
	authType: z.enum(['none', 'api_key', 'bearer', 'basic']).default('none'),
	authConfig: z.record(z.string(), z.string()).default({})
});

export const GET: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB unavailable' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const rows = await db.select().from(integrations).orderBy(asc(integrations.name));
	return json(rows.map((r) => ({ ...r, authConfig: maskAuthConfig(JSON.parse(r.authConfig ?? '{}')) })));
};

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB unavailable' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const data = createSchema.parse(await request.json());
	const id = crypto.randomUUID();
	await db.insert(integrations).values({
		id,
		name: data.name,
		description: data.description,
		baseUrl: data.baseUrl,
		authType: data.authType,
		authConfig: JSON.stringify(data.authConfig)
	});
	const [row] = await db.select().from(integrations).where(eq(integrations.id, id));
	return json({ ...row, authConfig: maskAuthConfig(JSON.parse(row.authConfig ?? '{}')) }, { status: 201 });
};
