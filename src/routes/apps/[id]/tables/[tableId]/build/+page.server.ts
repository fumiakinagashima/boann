import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getEntityTypeById, getFieldsByEntityTypeId, listEntityTypesSimple } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const [app, allApps] = await Promise.all([
		getEntityTypeById(db, params.tableId),
		listEntityTypesSimple(db)
	]);
	if (!app) error(404, 'テーブルが見つかりません');
	const [fields, otherApps] = await Promise.all([
		getFieldsByEntityTypeId(db, params.tableId),
		Promise.all(
			allApps
				.filter(a => a.id !== params.tableId)
				.map(async a => {
					const appFields = await getFieldsByEntityTypeId(db, a.id);
					return {
						id: a.id,
						name: a.name,
						label: a.label,
						icon: a.icon,
						fields: appFields.map(f => ({ key: f.key, label: f.label }))
					};
				})
		)
	]);
	return { app, appId: params.id, fields, otherApps };
};
