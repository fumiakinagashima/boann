import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { createDb } from '$lib/server/db';
import { updateAccount } from '$lib/server/db/account-service';
import { hashPassword } from '$lib/server/auth/password';
import { getPasswordResetAccountId, deletePasswordResetToken } from '$lib/server/auth/password-reset';
import { errors } from '$lib/server/errors';

const resetPasswordInputSchema = z.object({
	token: z.string().min(1),
	newPassword: z.string().min(8)
});

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB || !platform.env.KV) return errors.serviceUnavailable('Not available');

	const data = resetPasswordInputSchema.parse(await request.json());

	const accountId = await getPasswordResetAccountId(platform.env.KV, data.token);
	if (!accountId) {
		return errors.badRequest('The link is invalid or has expired');
	}

	const db = createDb(platform.env.DB);
	await updateAccount(db, accountId, { passwordHash: await hashPassword(data.newPassword) });
	await deletePasswordResetToken(platform.env.KV, data.token);

	return json({ ok: true });
};
