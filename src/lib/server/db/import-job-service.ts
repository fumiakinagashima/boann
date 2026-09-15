import { eq } from 'drizzle-orm';
import type { Db } from './index';
import { importJobs } from './schema';
import type { ImportPlan } from '$lib/server/ai/import-plan';

export type ImportJobStatus = 'designing' | 'ready' | 'applying' | 'done' | 'error';

// A single message in the plan-refinement chat (lightweight — just text, not the full MessageContent).
export type ImportChatMessage = { role: 'user' | 'assistant'; text: string };

export type ImportJob = {
	id: string;
	accountId: string;
	status: ImportJobStatus;
	filename: string | null;
	content: string | null;
	plan: ImportPlan | null;
	chat: ImportChatMessage[];
	appId: string | null;
	error: string | null;
};

function toJob(r: typeof importJobs.$inferSelect): ImportJob {
	return {
		id: r.id,
		accountId: r.accountId,
		status: r.status as ImportJobStatus,
		filename: r.filename,
		content: r.content,
		plan: r.plan ? (JSON.parse(r.plan) as ImportPlan) : null,
		chat: parseChat(r.chat),
		appId: r.appId,
		error: r.error
	};
}

function parseChat(raw: string | null | undefined): ImportChatMessage[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as ImportChatMessage[]) : [];
	} catch {
		return [];
	}
}

export async function createImportJob(
	db: Db,
	input: { accountId: string; filename: string; content: string }
): Promise<ImportJob> {
	const id = crypto.randomUUID();
	await db.insert(importJobs).values({
		id,
		accountId: input.accountId,
		status: 'designing',
		filename: input.filename,
		content: input.content
	});
	return (await getImportJob(db, id))!;
}

export async function getImportJob(db: Db, id: string): Promise<ImportJob | null> {
	const [r] = await db.select().from(importJobs).where(eq(importJobs.id, id));
	return r ? toJob(r) : null;
}

export async function updateImportJob(
	db: Db,
	id: string,
	patch: {
		status?: ImportJobStatus;
		plan?: ImportPlan | null;
		chat?: ImportChatMessage[];
		appId?: string | null;
		error?: string | null;
	}
): Promise<void> {
	const set: Record<string, unknown> = { updatedAt: new Date() };
	if (patch.status !== undefined) set.status = patch.status;
	if (patch.plan !== undefined) set.plan = patch.plan === null ? null : JSON.stringify(patch.plan);
	if (patch.chat !== undefined) set.chat = JSON.stringify(patch.chat);
	if (patch.appId !== undefined) set.appId = patch.appId;
	if (patch.error !== undefined) set.error = patch.error;
	await db.update(importJobs).set(set).where(eq(importJobs.id, id));
}
