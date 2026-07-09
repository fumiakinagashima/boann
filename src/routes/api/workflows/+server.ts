import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { createWorkflow } from '$lib/server/db/workflow-service';
import { listEntityTypesForWorkflow } from '$lib/server/db/table-service';
import { listSlackIntegrationsForWorkflow } from '$lib/server/slack';
import { validateWorkflow } from '$lib/workflow-validation';
import type { WorkflowStep } from '$lib/types/chat';

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	try {
		const db = createDb(platform.env.DB);
		const body = (await request.json()) as {
			name?: string;
			triggerType?: 'schedule' | 'event';
			triggerHour?: number;
			triggerMinute?: number;
			triggerEvent?: 'create' | 'update' | 'delete' | null;
			triggerEntityTypeId?: string | null;
			steps?: WorkflowStep[];
			appId?: string;
		};
		const name = body.name?.trim();
		if (!name) return json({ error: 'ワークフロー名を入力してください' }, { status: 422 });
		const triggerType = body.triggerType ?? 'schedule';
		const triggerHour = body.triggerHour ?? 9;
		const triggerMinute = body.triggerMinute ?? 0;
		const steps = body.steps ?? [];

		if (steps.length > 0) {
			const [entityTypes, slackIntegrations] = await Promise.all([
				listEntityTypesForWorkflow(db),
				listSlackIntegrationsForWorkflow(db)
			]);
			const validation = validateWorkflow(triggerType, triggerHour, triggerMinute, body.triggerEntityTypeId, steps, entityTypes, slackIntegrations);
			if (!validation.ok) {
				return json({ error: validation.errors.join(' / ') }, { status: 422 });
			}
		}

		const row = await createWorkflow(db, {
			name,
			steps,
			triggerType,
			triggerHour,
			triggerMinute,
			triggerEvent: body.triggerEvent,
			triggerEntityTypeId: body.triggerEntityTypeId,
			accountId: locals.account?.id,
			appId: body.appId
		});
		return json(row);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
