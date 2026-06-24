import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getWorkflow, deleteWorkflow, updateWorkflow } from '$lib/server/db/workflow-service';
import { listEntityTypesForWorkflow } from '$lib/server/db/table-service';
import { listSlackIntegrationsForWorkflow } from '$lib/server/slack';
import { validateWorkflow } from '$lib/workflow-validation';
import type { WorkflowStep } from '$lib/types/chat';

export const PATCH: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	try {
		const db = createDb(platform.env.DB);
		const existing = await getWorkflow(db, params.id);
		if (!existing) return json({ error: 'Not found' }, { status: 404 });
		if (existing.accountId && existing.accountId !== locals.account?.id) {
			return json({ error: '権限がありません' }, { status: 403 });
		}
		const body = (await request.json()) as {
			name?: string;
			triggerHour?: number;
			triggerMinute?: number;
			steps?: WorkflowStep[];
			enabled?: boolean;
		};
		const name = body.name?.trim() ?? existing.name;
		const triggerHour = body.triggerHour ?? existing.triggerHour;
		const triggerMinute = body.triggerMinute ?? existing.triggerMinute;
		const steps = body.steps ?? existing.steps;

		const [entityTypes, slackIntegrations] = await Promise.all([
			listEntityTypesForWorkflow(db),
			listSlackIntegrationsForWorkflow(db)
		]);
		const validation = validateWorkflow(triggerHour, triggerMinute, steps, entityTypes, slackIntegrations);
		if (!validation.ok) {
			return json({ error: validation.errors.join(' / ') }, { status: 422 });
		}

		const row = await updateWorkflow(db, params.id, {
			name,
			steps,
			triggerHour,
			triggerMinute,
			enabled: body.enabled
		});
		return json(row);
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	try {
		const db = createDb(platform.env.DB);
		const workflow = await getWorkflow(db, params.id);
		if (!workflow) return json({ error: 'Not found' }, { status: 404 });
		if (workflow.accountId && workflow.accountId !== locals.account?.id) {
			return json({ error: '権限がありません' }, { status: 403 });
		}
		await deleteWorkflow(db, params.id);
		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
