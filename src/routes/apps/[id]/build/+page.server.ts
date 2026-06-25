import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getEntityTypeById, getFieldsByEntityTypeId } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	if (locals.account?.permission !== 'admin') redirect(303, `/apps/${params.id}`);
	if (!platform?.env?.DB) error(500);
	const db = createDb(platform.env.DB);
	const app = await getEntityTypeById(db, params.id);
	if (!app) error(404, 'アプリが見つかりません');
	const fields = await getFieldsByEntityTypeId(db, params.id);
	return { app, fields };
};
