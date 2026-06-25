import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { listApps } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) return { apps: [] };
	const db = createDb(platform.env.DB);
	const apps = await listApps(db);
	return { apps };
};
