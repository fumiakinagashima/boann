import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { createDb } from '$lib/server/db';
import { getEntityTypeById, getFieldsByEntityTypeId, listEntityTypesSimple, deleteEntityType } from '$lib/server/db/table-service';
import { findWorkflowsUsingEntityType } from '$lib/server/db/workflow-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const [app, allApps] = await Promise.all([
		getEntityTypeById(db, params.tableId),
		listEntityTypesSimple(db, params.id)
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

export const actions: Actions = {
	delete: async ({ params, platform }) => {
		if (!platform?.env?.DB) error(500);
		const db = createDb(platform.env.DB);
		const et = await getEntityTypeById(db, params.tableId);
		if (!et) error(404, 'テーブルが見つかりません');
		const used = await findWorkflowsUsingEntityType(db, et.id);
		if (used.length > 0) {
			return fail(409, {
				message: `このテーブルはワークフロー（${used.map((w) => w.name).join(', ')}）で使用されているため削除できません。`
			});
		}
		await deleteEntityType(db, et.name, et.appId);
		redirect(303, `/apps/${params.id}`);
	}
};
