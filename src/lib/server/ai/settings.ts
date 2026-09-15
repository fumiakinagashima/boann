import { eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db';
import { aiSettings } from '$lib/server/db/schema';

export const DEFAULT_AI_MODEL = 'claude-haiku-4-5-20251001';

export const AI_MODEL_OPTIONS = [
	{ value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fast, low cost)' },
	{ value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (balanced)' },
	{ value: 'claude-opus-4-8', label: 'Claude Opus 4.8 (highest performance)' }
];

const SETTINGS_ID = 'default';

export async function getAiModel(db: Db): Promise<string> {
	const [row] = await db.select({ model: aiSettings.model }).from(aiSettings).where(eq(aiSettings.id, SETTINGS_ID));
	return row?.model ?? DEFAULT_AI_MODEL;
}

export async function setAiModel(db: Db, model: string): Promise<void> {
	const [existing] = await db.select({ id: aiSettings.id }).from(aiSettings).where(eq(aiSettings.id, SETTINGS_ID));
	if (existing) {
		await db.update(aiSettings).set({ model, updatedAt: new Date() }).where(eq(aiSettings.id, SETTINGS_ID));
	} else {
		await db.insert(aiSettings).values({ id: SETTINGS_ID, model });
	}
}
