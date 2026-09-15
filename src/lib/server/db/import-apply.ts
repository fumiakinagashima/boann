import type { Db } from './index';
import { createApp, createEntityType, deleteApp } from './table-service';
import type { ImportPlan } from '$lib/server/ai/import-plan';

// Applies the plan to the DB deterministically. No LLM is involved.
// If it fails partway through, rolls back the created app (and everything under it) to avoid orphaned data.
export async function applyImportPlan(db: Db, plan: ImportPlan): Promise<{ appId: string }> {
	const app = await createApp(db, {
		name: plan.app.name,
		label: plan.app.label,
		icon: plan.app.icon
	});

	try {
		for (const table of plan.tables) {
			await createEntityType(db, {
				name: table.name,
				label: table.label,
				icon: table.icon,
				appId: app.id,
				fields: table.fields.map((f) => ({
					_id: crypto.randomUUID(),
					key: f.key,
					label: f.label,
					type: f.type,
					required: f.required,
					options: f.options,
					refTable: f.ref_table
				}))
			});
		}

		return { appId: app.id };
	} catch (e) {
		// Delete the created app and its tables together (best effort)
		try {
			await deleteApp(db, app.id);
		} catch {
			/* Swallow rollback failures (prioritize the original error) */
		}
		throw e;
	}
}
