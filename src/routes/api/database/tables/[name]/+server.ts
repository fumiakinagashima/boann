import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import {
	updateEntityType, deleteEntityType, updateCoreCustomFields, getEntityTypeByName,
	CORE_TABLE_NAMES, type EntityTypeInput, type EditableField
} from '$lib/server/db/table-service';
import { findWorkflowsUsingEntityType } from '$lib/server/db/workflow-service';

export const PATCH: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	try {
		const input = await request.json() as Partial<EntityTypeInput> & { fields?: EditableField[] };
		if (CORE_TABLE_NAMES.includes(params.name)) {
			await updateCoreCustomFields(db, params.name, input.fields ?? []);
		} else {
			await updateEntityType(db, params.name, input);
		}
		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform, url }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	if (url.searchParams.get('force') !== '1') {
		const et = await getEntityTypeByName(db, params.name);
		if (et) {
			const workflows = await findWorkflowsUsingEntityType(db, et.id);
			if (workflows.length > 0) {
				return json({ error: 'used_by_workflows', workflows }, { status: 409 });
			}
		}
	}
	await deleteEntityType(db, params.name);
	return new Response(null, { status: 204 });
};
