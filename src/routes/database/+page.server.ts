import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { listAllTables } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ platform }) => {
	const db = createDb(platform!.env.DB);
	const tables = await listAllTables(db);
	return { tables };
};
