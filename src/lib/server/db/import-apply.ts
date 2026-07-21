import type { Db } from './index';
import { createApp, createEntityType, deleteApp } from './table-service';
import type { ImportPlan } from '$lib/server/ai/import-plan';

// プランを決定的にDBへ反映する。LLMは介在しない。
// 途中で失敗した場合は作成済みの app ごとロールバックして孤立を防ぐ。
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
		// 作成済みの app・テーブルをまとめて削除（ベストエフォート）
		try {
			await deleteApp(db, app.id);
		} catch {
			/* ロールバック失敗は握りつぶす（元のエラーを優先） */
		}
		throw e;
	}
}
