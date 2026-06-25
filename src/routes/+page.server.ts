import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { listTables } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { apps: [] };
	const db = createDb(platform.env.DB);
	const apps = await listTables(db);
	return { apps };
};
