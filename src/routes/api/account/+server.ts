import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { createDb } from '$lib/server/db';
import { listAccounts, updateAccount } from '$lib/server/db/account-service';
import { errors } from '$lib/server/errors';

const updateAccountSelfInputSchema = z.object({
	name: z.string().min(1),
	email: z.string().email().optional().or(z.literal('')),
	role: z.string().optional()
});

export const PATCH: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);

	const data = updateAccountSelfInputSchema.parse(await request.json());

	if (data.email) {
		const existingAccounts = await listAccounts(db);
		if (existingAccounts.some((a) => a.id !== locals.account!.id && a.email === data.email)) {
			return errors.badRequest('This email address is already in use');
		}
	}

	const row = await updateAccount(db, locals.account!.id, {
		name: data.name,
		...(data.email ? { email: data.email } : {}),
		...(data.role ? { role: data.role } : {})
	});
	return json(row);
};
