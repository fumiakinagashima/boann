import { error } from '@sveltejs/kit';
import { createDb } from '$lib/server/db';
import { listEntityTypesForWorkflow } from '$lib/server/db/table-service';
import { listSlackIntegrationsForWorkflow } from '$lib/server/slack';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform?.env?.DB) error(500, 'DB not available');
	const db = createDb(platform.env.DB);
	const [entityTypes, slackIntegrations] = await Promise.all([
		listEntityTypesForWorkflow(db),
		listSlackIntegrationsForWorkflow(db)
	]);
	return { entityTypes, slackIntegrations };
};
