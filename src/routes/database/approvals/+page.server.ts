import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { listApprovals } from '$lib/server/db/approval-service';
import { listAccounts } from '$lib/server/db/account-service';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const db = createDb(platform!.env.DB);
	const [rows, accountOptions] = await Promise.all([listApprovals(db), listAccounts(db)]);
	return { rows, accountOptions, accountId: locals.account?.id };
};
