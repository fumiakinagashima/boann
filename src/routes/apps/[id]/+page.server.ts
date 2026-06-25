import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getEntityTypeById, getFieldsByEntityTypeId, listRecordsByEntityTypeId } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const app = await getEntityTypeById(db, params.id);
	if (!app) error(404, 'アプリが見つかりません');
	const [fields, records] = await Promise.all([
		getFieldsByEntityTypeId(db, params.id),
		listRecordsByEntityTypeId(db, params.id)
	]);
	return { app, fields, records };
};
