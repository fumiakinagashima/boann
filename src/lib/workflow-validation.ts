import type { WorkflowStep, WorkflowResultType } from './types/chat';
import {
	getWorkflowActionTool,
	parseStepRef,
	parseItemRef,
	parseTriggerRef,
	parseInputRef,
	entityListItemFields,
	triggerFieldsFor,
	preQuoteReferences,
	SELF_ACCOUNT_ID_REF,
	type WorkflowListResultField
} from './workflow-tools';
import { WORKFLOW_MAX_RETRIES } from './constants';

type EntityTypeForValidation = { id: string; fields?: WorkflowListResultField[] };
type SlackIntegrationForValidation = { id: string };
type IntegrationForValidation = { id: string };

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
	/** null = フィールド構成が事前にわからない(call_external_apiをforeachのsourceに@step:<id>.<path>で指定した場合等)。@item参照の存在チェックをスキップする。 */
	itemFields: WorkflowListResultField[] | null;
};

/** ネストしたforeachのうち、いずれか1段の「現在の項目」スコープ。bodyの内側ではこのスタック（祖先のforeach全て）を全て参照できる。 */
export type ItemScope = {
	foreachStepId: string;
	/** null = フィールド構成が事前にわからない(call_external_apiをforeachのsourceに@step:<id>.<path>で指定した場合等)。@item参照の存在チェックをスキップする。 */
	itemFields: WorkflowListResultField[] | null;
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
		} else if (step.kind === 'foreach') {
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
			// call_external_apiはlistVisibleに載せない: `@step:<id>`(パス無し)では一覧化されず、
			// `@step:<id>.<path>`（パス指定）で参照する場合はcheckStepのforeach分岐で別途許可している。
		} else if (step.kind === 'condition') {
			walkList(step.then, visible, out, entityTypes);
		} else if (step.kind === 'foreach') {
			walkList(step.body, visible, out, entityTypes);
		}
	}
}

function resolveOperandType(
	operand: string,
	visible: VisibleStep[],
	itemScopes: ItemScope[],
	triggerFields: WorkflowListResultField[] | null,
	inputFields: WorkflowListResultField[]
): { ok: true; type: WorkflowResultType } | { ok: false; error: string } {
	const itemRef = parseItemRef(operand);
	if (itemRef !== null) {
		const scope = itemRef.foreachStepId
			? itemScopes.find((s) => s.foreachStepId === itemRef.foreachStepId)
			: itemScopes[itemScopes.length - 1];
		if (!scope) return { ok: false, error: `@item参照はforeachの中でのみ使用できます: ${operand}` };
		// itemFields===null は構成不明(call_external_apiをforeachのsourceに@step:<id>.<path>で指定した場合等)を
		// 意味し、存在チェックをスキップする
		if (scope.itemFields && !scope.itemFields.some((f) => f.key === itemRef.field)) {
			return { ok: false, error: `存在しない項目フィールドです: ${itemRef.field}` };
		}
		return { ok: true, type: 'string' };
	}
	const triggerField = parseTriggerRef(operand);
	if (triggerField !== null) {
		if (!triggerFields) return { ok: false, error: `@trigger参照はイベントトリガーでのみ使用できます: ${operand}` };
		if (!triggerFields.some((f) => f.key === triggerField)) {
			return { ok: false, error: `トリガーレコードに存在しないフィールドです: ${triggerField}` };
		}
		return { ok: true, type: 'string' };
	}
	const inputField = parseInputRef(operand);
	if (inputField !== null) {
		if (!inputFields.some((f) => f.key === inputField)) {
			return { ok: false, error: `宣言されていない入力パラメータです: ${inputField}` };
		}
		return { ok: true, type: 'string' };
	}
	if (operand === SELF_ACCOUNT_ID_REF) return { ok: true, type: 'string' };
	const stepRef = parseStepRef(operand);
	if (stepRef === null) return { ok: true, type: 'string' }; // リテラルは文字列として扱う
	const found = visible.find((v) => v.id === stepRef.id);
	if (!found) return { ok: false, error: `参照先のステップが見つかりません（または参照できる範囲外です）: ${stepRef.id}` };
	// パス指定（@step:<id>.<path>）は静的に型を決められないためstring扱い(存在チェックもスキップ、
	// @itemの構成不明ケースと同じ方針)。実行時のエラー（フィールドが無い等）はrun.ts側で検出する。
	if (stepRef.path !== null) return { ok: true, type: 'string' };
	return { ok: true, type: found.resultType };
}

export function validateWorkflow(
	triggerType: 'schedule' | 'event' | 'mcp_tool' = 'schedule',
	triggerHour: number,
	triggerMinute: number,
	triggerEntityTypeId: string | null | undefined,
	steps: WorkflowStep[],
	entityTypes: EntityTypeForValidation[] = [],
	slackIntegrations: SlackIntegrationForValidation[] = [],
	inputSchema: { key: string; label: string }[] = [],
	integrations: IntegrationForValidation[] = []
): ValidationResult {
	const errors: string[] = [];
	const entityTypeIds = new Set(entityTypes.map((e) => e.id));
	const slackIntegrationIds = new Set(slackIntegrations.map((s) => s.id));
	const integrationIds = new Set(integrations.map((i) => i.id));
	const triggerFields =
		triggerType === 'event'
			? triggerFieldsFor(
					entityTypes.map((e) => ({ id: e.id, fields: e.fields ?? [] })),
					triggerEntityTypeId
				)
			: null;

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
			if (tool.value === 'call_external_api') {
				const integrationId = step.params?.integration_id;
				if (!integrationId || !integrationIds.has(integrationId)) {
					errors.push(`「${step.label}」の外部API連携先が見つかりません（削除された可能性があります）`);
				}
			}
			if (step.maxRetries !== undefined && (!Number.isInteger(step.maxRetries) || step.maxRetries < 0 || step.maxRetries > WORKFLOW_MAX_RETRIES)) {
				errors.push(`「${step.label}」のリトライ回数は0〜${WORKFLOW_MAX_RETRIES}の範囲で指定してください`);
			}
			for (const field of tool.params) {
				const value = step.params?.[field.key];
				if (field.required && !value) {
					errors.push(`「${step.label}」の「${field.label}」が未入力です`);
					continue;
				}
				if (value) {
					const resolved = resolveOperandType(value, visible, itemScopes, triggerFields, inputSchema);
					if (!resolved.ok) errors.push(`「${step.label}」の「${field.label}」: ${resolved.error}`);
					// run.tsの実行時パース（preQuoteReferences→JSON.parse）と同じ規則で、保存時点でも
					// JSON形式かどうかを検証する（実行時まで気づかないのを防ぐ）。
					if (field.jsonFormat) {
						try {
							JSON.parse(preQuoteReferences(value));
						} catch {
							errors.push(`「${step.label}」の「${field.label}」がJSON形式ではありません`);
						}
					}
				}
			}
		} else if (step.kind === 'condition') {
			if (!step.left) {
				errors.push(`「${step.label}」の判定対象が選択されていません`);
			} else if (
				parseStepRef(step.left) === null &&
				parseItemRef(step.left) === null &&
				parseTriggerRef(step.left) === null &&
				parseInputRef(step.left) === null &&
				step.left !== SELF_ACCOUNT_ID_REF
			) {
				errors.push(`「${step.label}」の判定対象は先行ステップの結果・@item・@trigger・@input・@selfのいずれかを選択してください`);
			} else {
				const leftResolved = resolveOperandType(step.left, visible, itemScopes, triggerFields, inputSchema);
				if (!leftResolved.ok) errors.push(`「${step.label}」の判定対象: ${leftResolved.error}`);
			}
			if (!step.right) {
				errors.push(`「${step.label}」の比較先が未入力です`);
			} else {
				const rightResolved = resolveOperandType(step.right, visible, itemScopes, triggerFields, inputSchema);
				if (!rightResolved.ok) errors.push(`「${step.label}」の比較先: ${rightResolved.error}`);
			}
			if (step.then.length === 0) {
				errors.push(`「${step.label}」のYes時の処理が1つもありません`);
			}
			for (const child of step.then) checkStep(child, itemScopes);
		} else if (step.kind === 'result') {
			if (!step.key) {
				errors.push(`「${step.label}」のキー名が未入力です`);
			}
			if (!step.value) {
				errors.push(`「${step.label}」の値が未入力です`);
			} else if (step.valueType === 'array') {
				// エディタは常にJSON.stringifyされた文字列配列を書き込むため、それ以外（AI生成データ等）は保存時点で弾く
				let parsedArray: unknown;
				try {
					parsedArray = JSON.parse(step.value);
				} catch {
					parsedArray = undefined;
				}
				if (!Array.isArray(parsedArray) || !parsedArray.every((v) => typeof v === 'string')) {
					errors.push(`「${step.label}」の値は文字列の配列（JSON形式）で指定してください`);
				}
			} else {
				const resolved = resolveOperandType(step.value, visible, itemScopes, triggerFields, inputSchema);
				if (!resolved.ok) errors.push(`「${step.label}」の値: ${resolved.error}`);
			}
		} else {
			const stepRef = parseStepRef(step.source);
			const listVisible = listVisibility.get(step.id) ?? [];
			const sourceStep = stepRef !== null && stepRef.path === null ? listVisible.find((v) => v.id === stepRef.id) : undefined;
			// パス指定（@step:<id>.<path>）は実行時でないと配列かどうか判定できないため、静的には許可する
			// （@itemの構成不明ケースと同じ方針。call_external_api以外を指定した場合等はrun.ts側でエラーになる）。
			const pathBasedSource = stepRef !== null && stepRef.path !== null;
			if (!step.source) {
				errors.push(`「${step.label}」の対象（一覧）が選択されていません`);
			} else if (!sourceStep && !pathBasedSource) {
				errors.push(`「${step.label}」の対象は一覧を返す先行ステップを選択してください`);
			}
			if (step.body.length === 0) {
				errors.push(`「${step.label}」の繰り返す内容が1つもありません`);
			}
			const bodyItemScopes = sourceStep
				? [...itemScopes, { foreachStepId: step.id, itemFields: sourceStep.itemFields }]
				: pathBasedSource
					? [...itemScopes, { foreachStepId: step.id, itemFields: null }]
					: itemScopes;
			for (const child of step.body) checkStep(child, bodyItemScopes);
		}
	}

	for (const step of steps) checkStep(step, []);

	return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
