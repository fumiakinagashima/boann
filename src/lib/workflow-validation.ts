import type { WorkflowStep, WorkflowResultType } from './types/chat';
import {
	getWorkflowActionTool,
	parseStepRef,
	parseItemRef,
	entityListItemFields,
	type WorkflowListResultField
} from './workflow-tools';

type EntityTypeForValidation = { id: string; fields?: WorkflowListResultField[] };
type SlackIntegrationForValidation = { id: string };

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export type VisibleStep = {
	id: string;
	label: string;
	resultType: WorkflowResultType;
	resultDesc?: string;
};

export type VisibleListStep = {
	id: string;
	label: string;
	itemFields: WorkflowListResultField[];
};

/** ネストしたforeachのうち、いずれか1段の「現在の項目」スコープ。bodyの内側ではこのスタック（祖先のforeach全て）を全て参照できる。 */
export type ItemScope = {
	foreachStepId: string;
	itemFields: WorkflowListResultField[];
};

/**
 * 各ステップの位置で「参照可能な先行ステップ（スカラー結果を持つアクションのみ）」を集める。
 * 条件の `then` ・ foreachの `body` の中だけで作られた結果は、そこを抜けた後の兄弟ステップからは
 * 見えない（その分岐・繰り返しが実行されたかどうか保証できないため）。
 */
export function collectVisibility(
	steps: WorkflowStep[],
	visibleBefore: VisibleStep[] = []
): Map<string, VisibleStep[]> {
	const out = new Map<string, VisibleStep[]>();
	walk(steps, visibleBefore, out);
	return out;
}

function walk(steps: WorkflowStep[], visibleBefore: VisibleStep[], out: Map<string, VisibleStep[]>) {
	let visible = visibleBefore;
	for (const step of steps) {
		out.set(step.id, visible);
		if (step.kind === 'action') {
			const tool = getWorkflowActionTool(step.tool);
			if (tool?.resultType) {
				visible = [...visible, { id: step.id, label: step.label, resultType: tool.resultType, resultDesc: tool.resultDesc }];
			}
		} else if (step.kind === 'condition') {
			walk(step.then, visible, out);
			// then を抜けた後は、then 内で作られた結果を見せない（visible はここでは更新しない）
		} else {
			walk(step.body, visible, out);
			// body を抜けた後は、body 内で作られた結果を見せない（visible はここでは更新しない）
		}
	}
}

/** foreachの `source` として参照できる「一覧を返す先行アクション」を集める。スコープ規則はcollectVisibilityと同じ。 */
export function collectListVisibility(
	steps: WorkflowStep[],
	visibleBefore: VisibleListStep[] = [],
	entityTypes: EntityTypeForValidation[] = []
): Map<string, VisibleListStep[]> {
	const out = new Map<string, VisibleListStep[]>();
	walkList(steps, visibleBefore, out, entityTypes);
	return out;
}

function walkList(
	steps: WorkflowStep[],
	visibleBefore: VisibleListStep[],
	out: Map<string, VisibleListStep[]>,
	entityTypes: EntityTypeForValidation[]
) {
	let visible = visibleBefore;
	for (const step of steps) {
		out.set(step.id, visible);
		if (step.kind === 'action') {
			const tool = getWorkflowActionTool(step.tool);
			if (tool?.listResult) {
				// get_entitiesはテーブルごとにフィールドが異なるため、選択中のentity_type_idから動的に解決する
				const itemFields =
					step.tool === 'get_entities'
						? entityListItemFields(
								entityTypes.map((e) => ({ id: e.id, fields: e.fields ?? [] })),
								step.params?.entity_type_id
							)
						: tool.listResult.itemFields;
				visible = [...visible, { id: step.id, label: step.label, itemFields }];
			}
		} else if (step.kind === 'condition') {
			walkList(step.then, visible, out, entityTypes);
		} else {
			walkList(step.body, visible, out, entityTypes);
		}
	}
}

function resolveOperandType(
	operand: string,
	visible: VisibleStep[],
	itemScopes: ItemScope[]
): { ok: true; type: WorkflowResultType } | { ok: false; error: string } {
	const itemRef = parseItemRef(operand);
	if (itemRef !== null) {
		const scope = itemRef.foreachStepId
			? itemScopes.find((s) => s.foreachStepId === itemRef.foreachStepId)
			: itemScopes[itemScopes.length - 1];
		if (!scope) return { ok: false, error: `@item参照はforeachの中でのみ使用できます: ${operand}` };
		if (!scope.itemFields.some((f) => f.key === itemRef.field)) {
			return { ok: false, error: `存在しない項目フィールドです: ${itemRef.field}` };
		}
		return { ok: true, type: 'string' };
	}
	const refId = parseStepRef(operand);
	if (refId === null) return { ok: true, type: 'string' }; // リテラルは文字列として扱う
	const found = visible.find((v) => v.id === refId);
	if (!found) return { ok: false, error: `参照先のステップが見つかりません（または参照できる範囲外です）: ${refId}` };
	return { ok: true, type: found.resultType };
}

export function validateWorkflow(
	triggerType: 'schedule' | 'event' = 'schedule',
	triggerHour: number,
	triggerMinute: number,
	steps: WorkflowStep[],
	entityTypes: EntityTypeForValidation[] = [],
	slackIntegrations: SlackIntegrationForValidation[] = []
): ValidationResult {
	const errors: string[] = [];
	const entityTypeIds = new Set(entityTypes.map((e) => e.id));
	const slackIntegrationIds = new Set(slackIntegrations.map((s) => s.id));

	if (triggerType === 'schedule') {
		if (!Number.isInteger(triggerHour) || triggerHour < 0 || triggerHour > 23) {
			errors.push('トリガーの時刻（時）が不正です');
		}
		if (!Number.isInteger(triggerMinute) || triggerMinute < 0 || triggerMinute > 59) {
			errors.push('トリガーの時刻（分）が不正です');
		}
	}
	if (steps.length === 0) {
		errors.push('ステップが1つもありません');
	}

	const visibility = collectVisibility(steps);
	const listVisibility = collectListVisibility(steps, [], entityTypes);

	function checkStep(step: WorkflowStep, itemScopes: ItemScope[]) {
		const visible = visibility.get(step.id) ?? [];
		if (step.kind === 'action') {
			const tool = getWorkflowActionTool(step.tool);
			if (!tool) {
				errors.push(`「${step.label}」のアクションが選択されていません`);
				return;
			}
			if (tool.value === 'get_entities') {
				const entityTypeId = step.params?.entity_type_id;
				if (!entityTypeId || !entityTypeIds.has(entityTypeId)) {
					errors.push(`「${step.label}」の対象テーブルが見つかりません（削除された可能性があります）`);
				}
			}
			if (tool.value === 'send_slack_notification') {
				const integrationId = step.params?.integration_id;
				if (!integrationId || !slackIntegrationIds.has(integrationId)) {
					errors.push(`「${step.label}」のSlack連携先が見つかりません（削除された可能性があります）`);
				}
			}
			for (const field of tool.params) {
				const value = step.params?.[field.key];
				if (field.required && !value) {
					errors.push(`「${step.label}」の「${field.label}」が未入力です`);
					continue;
				}
				if (value) {
					const resolved = resolveOperandType(value, visible, itemScopes);
					if (!resolved.ok) errors.push(`「${step.label}」の「${field.label}」: ${resolved.error}`);
				}
			}
		} else if (step.kind === 'condition') {
			if (!step.left) {
				errors.push(`「${step.label}」の判定対象が選択されていません`);
			} else if (parseStepRef(step.left) === null && parseItemRef(step.left) === null) {
				errors.push(`「${step.label}」の判定対象は先行ステップの結果または@itemを選択してください`);
			} else {
				const leftResolved = resolveOperandType(step.left, visible, itemScopes);
				if (!leftResolved.ok) errors.push(`「${step.label}」の判定対象: ${leftResolved.error}`);
			}
			if (!step.right) {
				errors.push(`「${step.label}」の比較先が未入力です`);
			} else {
				const rightResolved = resolveOperandType(step.right, visible, itemScopes);
				if (!rightResolved.ok) errors.push(`「${step.label}」の比較先: ${rightResolved.error}`);
			}
			if (step.then.length === 0) {
				errors.push(`「${step.label}」のYes時の処理が1つもありません`);
			}
			for (const child of step.then) checkStep(child, itemScopes);
		} else {
			const refId = parseStepRef(step.source);
			const listVisible = listVisibility.get(step.id) ?? [];
			const sourceStep = refId !== null ? listVisible.find((v) => v.id === refId) : undefined;
			if (!step.source) {
				errors.push(`「${step.label}」の対象（一覧）が選択されていません`);
			} else if (!sourceStep) {
				errors.push(`「${step.label}」の対象は一覧を返す先行ステップを選択してください`);
			}
			if (step.body.length === 0) {
				errors.push(`「${step.label}」の繰り返す内容が1つもありません`);
			}
			const bodyItemScopes = sourceStep
				? [...itemScopes, { foreachStepId: step.id, itemFields: sourceStep.itemFields }]
				: itemScopes;
			for (const child of step.body) checkStep(child, bodyItemScopes);
		}
	}

	for (const step of steps) checkStep(step, []);

	return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
