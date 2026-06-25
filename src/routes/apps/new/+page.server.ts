import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.account?.permission !== 'admin') redirect(303, '/');
	return {};
};
