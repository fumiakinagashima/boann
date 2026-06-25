import type { FieldDef } from '$lib/server/db/table-service';
import type { FormField } from '$lib/types/chat';
import { toJstDatetimeLocal } from '$lib/datetime';

/** 詳細から編集/新規フォームを開く際の指定。snake_case の FormContent ではなく camelCase の prefill を使う */
export type RecordFormSpec = {
	type: string;
	recordId?: string;
	prefill?: Record<string, string>;
};

/**
 * getTableInfo の FieldDef（camelCase）を chat/Form.svelte の FormField に変換する。
 * - フォーム用の選択肢は formOptions を優先（活動の「案件登録」など、表示には残すがフォームでは選択させない値を除外するため）
 * - values は呼び出し側で各フィールドの value に注入する（編集時はレコード値、登録時は prefill）
 */
export function fieldDefToFormField(
	field: FieldDef,
	value?: string
): FormField {
	return {
		key: field.key,
		label: field.label,
		type: field.type,
		required: field.required,
		refTable: field.refTable,
		options: field.formOptions ?? field.options,
		value: value ?? ''
	};
}

export function fieldDefsToFormFields(
	fields: FieldDef[],
	values: Record<string, unknown> = {}
): FormField[] {
	return fields.map((f) => {
		const raw = values[f.key];
		let value = '';
		if (raw != null && raw !== '') {
			if (f.type === 'datetime-local' && typeof raw === 'number') {
				// unix timestamp → JST datetime-local 文字列に変換
				value = toJstDatetimeLocal(new Date(raw * 1000));
			} else {
				value = String(raw);
			}
		}
		return fieldDefToFormField(f, value);
	});
}
