import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getTableInfo, getRecord } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = createDb(platform!.env.DB);
	const info = await getTableInfo(db, params.type);
	const record = await getRecord(db, params.type, params.id);
	return { info, record };
};
