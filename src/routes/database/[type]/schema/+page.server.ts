import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getTableInfo, listAllTables } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = createDb(platform!.env.DB);
	const [info, tables] = await Promise.all([
		getTableInfo(db, params.type),
		listAllTables(db)
	]);
	const availableTables = tables.map(t => ({ value: t.id, label: t.label }));
	return { info, availableTables };
};
