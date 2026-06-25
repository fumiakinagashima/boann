import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getEntityTypeById, getFieldsByEntityTypeId, listEntityTypesSimple } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	if (locals.account?.permission !== 'admin') redirect(303, `/apps/${params.id}`);
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const [app, allApps] = await Promise.all([
		getEntityTypeById(db, params.id),
		listEntityTypesSimple(db)
	]);
	if (!app) error(404, 'アプリが見つかりません');
	const [fields, otherApps] = await Promise.all([
		getFieldsByEntityTypeId(db, params.id),
		Promise.all(
			allApps
				.filter(a => a.id !== params.id)
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
	return { app, fields, otherApps };
};
