import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { listExternalApiConnections, maskHeaders } from '$lib/server/db/external-api-connection-service';

export const load: PageServerLoad = async ({ platform }) => {
	const db = createDb(platform!.env.DB);
	const rows = await listExternalApiConnections(db);
	const items = rows.map((r) => ({ ...r, headers: maskHeaders(r.headers) }));
	return { items };
};
