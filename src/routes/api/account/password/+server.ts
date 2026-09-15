import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { createDb } from '$lib/server/db';
import { getAccountWithPasswordById, updateAccount } from '$lib/server/db/account-service';
import { hashPassword, verifyPassword } from '$lib/server/auth/password';
import { errors } from '$lib/server/errors';

const updateAccountPasswordInputSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(8)
});

export const PATCH: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);

	const data = updateAccountPasswordInputSchema.parse(await request.json());

	const account = await getAccountWithPasswordById(db, locals.account!.id);
	if (!account?.passwordHash) {
		return errors.badRequest('The current password is incorrect');
	}

	const result = await verifyPassword(data.currentPassword, account.passwordHash);
	if (!result.valid) {
		return errors.badRequest('The current password is incorrect');
	}

	await updateAccount(db, locals.account!.id, { passwordHash: await hashPassword(data.newPassword) });
	return json({ ok: true });
};
