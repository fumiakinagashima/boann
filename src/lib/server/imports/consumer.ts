import type { Db } from '$lib/server/db';
import { applyImportPlan } from '$lib/server/db/import-apply';
import { getImportJob, updateImportJob } from '$lib/server/db/import-job-service';
import { createNotification } from '$lib/server/db/notification-service';
import { generateImportPlan, mockImportPlan, importPlanSchema } from '$lib/server/ai/import-plan';
import { getAiModel } from '$lib/server/ai/settings';
import type { ImportJobMessage } from './types';

type ConsumerEnv = { ANTHROPIC_API_KEY?: string; MOCK_AI?: string };

// The core job-processing logic for the Queue consumer. Called from the queue handler in worker.ts.
export async function processImportJob(
	db: Db,
	env: ConsumerEnv,
	message: ImportJobMessage
): Promise<void> {
	if (message.type === 'design') {
		await processDesign(db, env, message.jobId);
	} else {
		await processApply(db, message.jobId);
	}
}

// Design: passes the uploaded content to the AI to generate a plan, then marks the job ready.
async function processDesign(db: Db, env: ConsumerEnv, jobId: string): Promise<void> {
	const job = await getImportJob(db, jobId);
	if (!job) return;
	if (job.status === 'ready' && job.plan) return; // skip duplicate delivery
	if (!job.content) {
		await updateImportJob(db, jobId, { status: 'error', error: 'No file content was found' });
		return;
	}

	try {
		const filename = job.filename ?? 'untitled';
		const plan =
			env.MOCK_AI === 'true'
				? mockImportPlan(job.content)
				: await generateImportPlan({
						apiKey: env.ANTHROPIC_API_KEY ?? '',
						model: await getAiModel(db),
						content: job.content,
						filename
					});

		await updateImportJob(db, jobId, { status: 'ready', plan, error: null });
		await createNotification(db, {
			type: 'import',
			title: 'App design complete',
			body: `Please review the plan for "${plan.app.label}".`,
			seedContent: [
				{
					type: 'link',
					label: `Review the plan for ${plan.app.label}`,
					href: `/imports/${jobId}`,
					description: 'The app plan designed from the file'
				}
			],
			accountId: job.accountId
		});
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		await updateImportJob(db, jobId, { status: 'error', error });
		await createNotification(db, {
			type: 'import',
			title: 'App design failed',
			body: `An error occurred while designing the file: ${error}`,
			seedContent: [],
			accountId: job.accountId
		});
	}
}

// apply: deterministically applies the drafted plan to create the app. Idempotent.
async function processApply(db: Db, jobId: string): Promise<void> {
	const job = await getImportJob(db, jobId);
	if (!job) return;
	if (job.status === 'done') return; // skip duplicate delivery

	const parsed = importPlanSchema.safeParse(job.plan);
	if (!parsed.success) {
		await updateImportJob(db, jobId, { status: 'error', error: 'The plan format is invalid' });
		return;
	}

	try {
		const { appId } = await applyImportPlan(db, parsed.data);
		await updateImportJob(db, jobId, { status: 'done', appId, error: null });
		await createNotification(db, {
			type: 'import',
			title: 'App created',
			body: `Created "${parsed.data.app.label}".`,
			seedContent: [
				{
					type: 'link',
					label: `Open ${parsed.data.app.label}`,
					href: `/apps/${appId}`,
					description: 'The app created from the file'
				}
			],
			accountId: job.accountId
		});
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		await updateImportJob(db, jobId, { status: 'error', error });
		await createNotification(db, {
			type: 'import',
			title: 'App creation failed',
			body: `An error occurred while creating "${parsed.data.app.label}": ${error}`,
			seedContent: [],
			accountId: job.accountId
		});
	}
}
