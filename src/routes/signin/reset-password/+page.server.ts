import type { PageServerLoad } from './$types';
import { getPasswordResetAccountId } from '$lib/server/auth/password-reset';

export const load: PageServerLoad = async ({ url, platform }) => {
	const token = url.searchParams.get('token') ?? '';

	if (!token || !platform?.env?.KV) {
		return { tokenValid: false };
	}

	const accountId = await getPasswordResetAccountId(platform.env.KV, token);
	return { tokenValid: accountId !== null };
};
