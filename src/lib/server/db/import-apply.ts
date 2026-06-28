import type { Db } from './index';
import { createApp, createEntityType, createPage, deleteApp } from './table-service';
import type { PageComponent } from './table-service';
import type { ImportPlan } from '$lib/server/ai/import-plan';

// プランを決定的にDBへ反映する。LLMは介在しない。
// ページコンポーネントはプラン内ではテーブルを name で参照しているため、
// 生成済みテーブルの id に解決してから保存する。
// 途中で失敗した場合は作成済みの app ごとロールバックして孤立を防ぐ。
export async function applyImportPlan(
	db: Db,
	plan: ImportPlan
): Promise<{ appId: string; firstPageId: string | null }> {
	const app = await createApp(db, {
		name: plan.app.name,
		label: plan.app.label,
		icon: plan.app.icon
	});

	try {
		const nameToId = new Map<string, string>();
		for (const table of plan.tables) {
			const res = await createEntityType(db, {
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
			nameToId.set(table.name, res.id);
		}

		let firstPageId: string | null = null;
		for (const page of plan.pages) {
			const components: PageComponent[] = page.components.map((c) => {
				const tableId = nameToId.get(c.table_name);
				if (!tableId) {
					throw new Error(
						`ページ「${page.label}」が参照するテーブル「${c.table_name}」がプランに存在しません。`
					);
				}
				return {
					id: crypto.randomUUID(),
					type: c.type,
					tableId,
					title: c.title ?? null,
					fields: c.fields ?? null,
					actions: c.actions ?? ['create', 'edit', 'delete']
				};
			});
			const res = await createPage(db, app.id, { label: page.label, components });
			if (!firstPageId) firstPageId = res.id;
		}

		return { appId: app.id, firstPageId };
	} catch (e) {
		// 作成済みの app・テーブル・ページをまとめて削除（ベストエフォート）
		try {
			await deleteApp(db, app.id);
		} catch {
			/* ロールバック失敗は握りつぶす（元のエラーを優先） */
		}
		throw e;
	}
}
