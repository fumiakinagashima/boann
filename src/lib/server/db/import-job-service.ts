import { eq } from 'drizzle-orm';
import type { Db } from './index';
import { importJobs } from './schema';

export type ImportJobStatus = 'queued' | 'processing' | 'done' | 'error';

export type ImportJob = {
	id: string;
	accountId: string;
	status: ImportJobStatus;
	appId: string | null;
	error: string | null;
};

function toJob(r: typeof importJobs.$inferSelect): ImportJob {
	return {
		id: r.id,
		accountId: r.accountId,
		status: r.status as ImportJobStatus,
		appId: r.appId,
		error: r.error
	};
}

export async function createImportJob(db: Db, accountId: string): Promise<ImportJob> {
	const id = crypto.randomUUID();
	await db.insert(importJobs).values({ id, accountId, status: 'queued' });
	return (await getImportJob(db, id))!;
}

export async function getImportJob(db: Db, id: string): Promise<ImportJob | null> {
	const [r] = await db.select().from(importJobs).where(eq(importJobs.id, id));
	return r ? toJob(r) : null;
}

export async function updateImportJob(
	db: Db,
	id: string,
	patch: { status: ImportJobStatus; appId?: string | null; error?: string | null }
): Promise<void> {
	await db
		.update(importJobs)
		.set({
			status: patch.status,
			...(patch.appId !== undefined ? { appId: patch.appId } : {}),
			...(patch.error !== undefined ? { error: patch.error } : {}),
			updatedAt: new Date()
		})
		.where(eq(importJobs.id, id));
}
