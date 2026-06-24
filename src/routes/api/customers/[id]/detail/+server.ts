import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { handleGetCustomerDetail } from '$lib/server/mcp/customers';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);

	try {
		const { contacts, deals, activities, ...customer } = await handleGetCustomerDetail(db, { id: params.id });
		return json({ customer, contacts, deals, activities });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: msg }, { status: 404 });
	}
};
