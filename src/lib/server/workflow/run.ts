import type { Db } from '../db';
import type { ToolEnv } from '../tools/shared';
import { dispatchTool, type ToolName } from '../tools';
import { getEnabledWorkflows, getWorkflow, type WorkflowRow } from '../db/workflow-service';
import { recordWorkflowRun, type StepLog } from '../db/workflow-run-service';
import { getAccount } from '../db/account-service';
import { getJstHourMinute } from '$lib/datetime';
import { getWorkflowActionTool, parseStepRef, parseItemRef, resolveJsonPath } from '$lib/workflow-tools';
import { WORKFLOW_FOREACH_MAX_ITEMS, WORKFLOW_MAX_ACTIONS_PER_RUN, WORKFLOW_MAX_RETRIES, WORKFLOW_RETRY_DELAY_MS } from '$lib/constants';
import { createRecordByEntityTypeId, updateRecordByEntityTypeId, deleteRecord } from '../db/table-service';
import { getExternalApiConnection, callExternalApiConnection } from '../db/external-api-connection-service';
import type {
	WorkflowStep,
	WorkflowActionStep,
	WorkflowForeachStep,
	WorkflowResultType
} from '$lib/types/chat';

export type TriggerEvent = 'create' | 'update' | 'delete';
export type TriggerContext = {
	event: TriggerEvent;
	recordId: string;
	entityTypeId: string;
	/** トリガーとなったレコードのフィールド値スナップショット（@trigger:<field> で参照する）。 */
	data?: Record<string, unknown>;
};

/** ワークフロー登録者自身の情報。selfEmail は send_email の宛先、accountId は @self:account_id の解決に使う。 */
type SelfContext = { email: string | null; accountId: string | null };

/**
 * raw は「抽出前の生の値」（オブジェクト/配列等）で、`@step:<id>.<path>` によるプロパティアクセス用。
 * 現状call_external_apiだけが設定する（他アクションの結果はもともとスカラーで分解する意味が無い）。
 */
type StepResult = { type: WorkflowResultType; value: boolean | number | string; raw?: unknown };
type ListResults = Map<string, Record<string, unknown>[]>;
/** ネストしたforeachの「現在の項目」をforeachのidごとに積んだスタック。配列の末尾が最も内側のforeach。 */
type ItemStack = { foreachStepId: string; item: Record<string, unknown> }[];

/** ワークフロー実行を即時中断させるためのエラー（未定義の変数参照・未対応ツール等）。 */
class WorkflowAbortError extends Error {}

/**
 * ネストしたforeachの組み合わせ爆発（例: 50件×50件×50件の3段ネスト）を防ぐための、
 * 1回の実行全体で許容するアクション実行回数の残量。runSteps/runForeachの再帰全体で1つを共有する。
 */
type Budget = { remaining: number };

function consumeBudget(budget: Budget): void {
	if (budget.remaining <= 0) {
		throw new WorkflowAbortError(
			`1回の実行で許容するアクション数の上限（${WORKFLOW_MAX_ACTIONS_PER_RUN}）を超えました。foreachのネストやリトライ回数を減らしてください`
		);
	}
	budget.remaining--;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * call_external_apiのレスポンスボディ(結果を格納する時)や`@step:<id>.<path>`参照でresolveJsonPathが
 * 取り出した値(型不明)をStepResultへ変換する。boolean/number/string以外(オブジェクト・配列・
 * null・undefined)はJSON文字列表現に落とす(値が確認できないより文字列化されている方が実用的なため)。
 */
function coerceScalarResult(value: unknown): StepResult {
	if (typeof value === 'boolean') return { type: 'boolean', value };
	if (typeof value === 'number') return { type: 'number', value };
	if (typeof value === 'string') return { type: 'string', value };
	if (value === undefined || value === null) return { type: 'string', value: '' };
	return { type: 'string', value: JSON.stringify(value) };
}

/**
 * data フィールド（JSON テキスト）内のクォートされていない @trigger:xxx / @step:xxx / @item:xxx / @self:xxx 参照を
 * クォートで囲んでから JSON.parse できるようにする。すでにクォート済みの場合は冪等。
 * JSON値の位置（`:` の直後〜`,`/`}` の直前）にある場合のみ対象とし、既存の文字列値の中に
 * 地の文として "@self:account_id" 等が含まれるケースを誤って壊さないようにする。
 */
export function preQuoteReferences(jsonStr: string): string {
	return jsonStr.replace(
		/:(\s*)(@(?:trigger|step|item|self|input):[a-zA-Z0-9_]+(?::[a-zA-Z0-9_]+)*)(\s*)([,}])/g,
		':$1"$2"$3$4'
	);
}

/** JSON.parse 済みの data オブジェクト内の文字列値に含まれる @参照を解決する。 */
function resolveDataValues(
	data: Record<string, unknown>,
	results: Map<string, StepResult>,
	itemStack: ItemStack,
	triggerContext?: TriggerContext,
	self?: SelfContext,
	inputArgs?: Record<string, unknown>
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(data)) {
		if (typeof v === 'string' && (v.startsWith('@trigger:') || v.startsWith('@step:') || v.startsWith('@item:') || v.startsWith('@self:') || v.startsWith('@input:'))) {
			out[k] = resolveOperand(v, results, itemStack, triggerContext, self, inputArgs).value;
		} else {
			out[k] = v;
		}
	}
	return out;
}

export function resolveOperand(
	operand: string,
	results: Map<string, StepResult>,
	itemStack: ItemStack,
	triggerContext?: TriggerContext,
	self?: SelfContext,
	inputArgs?: Record<string, unknown>
): StepResult {
	if (operand.startsWith('@trigger:')) {
		if (!triggerContext) throw new WorkflowAbortError('@trigger参照はイベントトリガーでのみ使用できます');
		const field = operand.slice('@trigger:'.length);
		if (field === 'id') return { type: 'string', value: triggerContext.recordId };
		if (field === 'event') return { type: 'string', value: triggerContext.event };
		const v = triggerContext.data?.[field];
		if (v === undefined) throw new WorkflowAbortError(`トリガーレコードに存在しないフィールドです: ${field}`);
		const type: WorkflowResultType = typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string';
		return { type, value: (v as boolean | number | string) ?? '' };
	}
	if (operand.startsWith('@self:')) {
		const field = operand.slice('@self:'.length);
		if (field === 'account_id') {
			if (!self?.accountId) throw new WorkflowAbortError('@self:account_id はワークフローの登録者が特定できないため使用できません');
			return { type: 'string', value: self.accountId };
		}
		throw new WorkflowAbortError(`未知の@self参照です: ${field}`);
	}
	if (operand.startsWith('@input:')) {
		const key = operand.slice('@input:'.length);
		const v = inputArgs?.[key];
		if (v === undefined) throw new WorkflowAbortError(`入力パラメータが指定されていません: ${key}`);
		const type: WorkflowResultType = typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string';
		return { type, value: (v as boolean | number | string) ?? '' };
	}
	const itemRef = parseItemRef(operand);
	if (itemRef !== null) {
		const scope = itemRef.foreachStepId
			? itemStack.find((s) => s.foreachStepId === itemRef.foreachStepId)
			: itemStack[itemStack.length - 1];
		if (!scope) throw new WorkflowAbortError(`@item参照はforeachの中でのみ使用できます: ${operand}`);
		const v = scope.item[itemRef.field];
		if (v === undefined) throw new WorkflowAbortError(`現在の項目に存在しないフィールドです: ${itemRef.field}`);
		const type: WorkflowResultType = typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string';
		return { type, value: (v as boolean | number | string) ?? '' };
	}
	const stepRef = parseStepRef(operand);
	if (stepRef === null) return { type: 'string', value: operand };
	const found = results.get(stepRef.id);
	if (!found) throw new WorkflowAbortError(`参照先のステップ結果が見つかりません: ${stepRef.id}`);
	if (stepRef.path === null) return found;
	// `@step:<id>.<path>` — rawが無いアクション（大半のツール、もともと分解不要なスカラーのみ返す）に
	// パスを指定した場合はエラーにする（@item参照が存在しないフィールドでエラーになるのと同じ扱い）。
	if (found.raw === undefined) {
		throw new WorkflowAbortError(`「${stepRef.id}」の結果はフィールドを指定して参照できません（call_external_api以外は非対応）: ${operand}`);
	}
	const resolved = resolveJsonPath(found.raw, stepRef.path);
	if (resolved === undefined) throw new WorkflowAbortError(`指定したフィールドが見つかりません: ${operand}`);
	return coerceScalarResult(resolved);
}

export function compare(left: StepResult, operator: string, right: StepResult): boolean {
	let rv: boolean | number | string = right.value;
	if (left.type === 'number') rv = typeof rv === 'number' ? rv : Number(rv);
	else if (left.type === 'boolean') {
		rv = typeof rv === 'boolean' ? rv : typeof rv === 'number' ? rv !== 0 : rv === 'true';
	}
	const lv = left.value;
	if (operator === '==') return lv === rv;
	if (operator === '!=') return lv !== rv;
	if (operator !== '>' && operator !== '<' && operator !== '>=' && operator !== '<=') {
		throw new WorkflowAbortError(`未対応の演算子です: ${operator}`);
	}
	// 順序比較: left.type が 'string' でも、両辺が数値として解釈できれば数値比較する。
	// CSV取り込みや create_entity の JSON data 等で数値が文字列化されているケースを
	// 素のJS文字列比較（辞書順、例: "10" > "9" が false になる）で誤判定しないため。
	const ln = typeof lv === 'number' ? lv : Number(lv);
	const rn = typeof rv === 'number' ? rv : Number(rv);
	const numeric = !Number.isNaN(ln) && !Number.isNaN(rn);
	const lc: number | string | boolean = numeric ? ln : lv;
	const rc: number | string | boolean = numeric ? rn : rv;
	switch (operator) {
		case '>':
			return lc > rc;
		case '<':
			return lc < rc;
		case '>=':
			return lc >= rc;
		default:
			return lc <= rc;
	}
}

/**
 * ステップを1回だけ実行する（リトライの単位）。設定不備（対象未選択・JSON不正等）は
 * WorkflowAbortErrorを投げてリトライさせない。それ以外の例外（外部API呼び出し失敗等）は
 * 呼び出し元（runAction）のリトライループが一時的な障害とみなして再試行しうる。
 */
async function performAction(
	db: Db,
	step: WorkflowActionStep,
	toolDef: NonNullable<ReturnType<typeof getWorkflowActionTool>>,
	resolvedParams: Record<string, string | number>,
	results: Map<string, StepResult>,
	listResults: ListResults,
	env: ToolEnv | undefined,
	self: SelfContext,
	itemStack: ItemStack,
	triggerContext?: TriggerContext,
	inputArgs?: Record<string, unknown>
): Promise<{ result?: string }> {
	// 検証用（一時的）: 解決済みの値をdevサーバーのターミナルにconsole.logするだけのデバッグアクション。
	// 本番運用には意味が無い(出力先はローカルdevのターミナルのみ)ため、不要になったら削除して良い。
	if (step.tool === 'console_log') {
		const value = resolvedParams['value'];
		console.log(`[workflow debug] 「${step.label}」:`, value);
		return { result: String(value) };
	}

	// エンティティ書き込み操作はMCPツールを介さずDBサービスを直接呼ぶ
	if (step.tool === 'create_entity') {
		const entityTypeId = step.params?.entity_type_id;
		if (!entityTypeId) throw new WorkflowAbortError(`「${step.label}」の対象テーブルが選択されていません`);
		const rawDataStr = step.params?.['data'] ?? '';
		if (!rawDataStr) throw new WorkflowAbortError(`「${step.label}」のデータが指定されていません`);
		let data: Record<string, unknown>;
		try { data = JSON.parse(preQuoteReferences(rawDataStr)); } catch { throw new WorkflowAbortError(`「${step.label}」のデータがJSON形式ではありません`); }
		data = resolveDataValues(data, results, itemStack, triggerContext, self, inputArgs);
		const record = await createRecordByEntityTypeId(db, entityTypeId, data, env?.accountId);
		return { result: `レコード作成完了（id: ${record.id}）` };
	}

	if (step.tool === 'update_entity') {
		const entityTypeId = step.params?.entity_type_id;
		if (!entityTypeId) throw new WorkflowAbortError(`「${step.label}」の対象テーブルが選択されていません`);
		const recordId = resolvedParams['id'] as string | undefined;
		if (!recordId) throw new WorkflowAbortError(`「${step.label}」のレコードIDが指定されていません`);
		const rawDataStr = step.params?.['data'] ?? '';
		if (!rawDataStr) throw new WorkflowAbortError(`「${step.label}」のデータが指定されていません`);
		let data: Record<string, unknown>;
		try { data = JSON.parse(preQuoteReferences(rawDataStr)); } catch { throw new WorkflowAbortError(`「${step.label}」のデータがJSON形式ではありません`); }
		data = resolveDataValues(data, results, itemStack, triggerContext, self, inputArgs);
		await updateRecordByEntityTypeId(db, entityTypeId, recordId, data, env?.accountId);
		return { result: `レコード更新完了（id: ${recordId}）` };
	}

	if (step.tool === 'delete_entity') {
		const entityTypeId = step.params?.entity_type_id;
		if (!entityTypeId) throw new WorkflowAbortError(`「${step.label}」の対象テーブルが選択されていません`);
		const recordId = resolvedParams['id'] as string | undefined;
		if (!recordId) throw new WorkflowAbortError(`「${step.label}」のレコードIDが指定されていません`);
		await deleteRecord(db, '', recordId);
		return { result: `レコード削除完了（id: ${recordId}）` };
	}

	// call_external_apiは`integrations`(Slack通知等、通知目的の連携)テーブルではなく、
	// 専用のexternal_api_connectionsテーブル(2026-07-22追加)を参照する。dispatchTool経由の
	// 内部AIツール(tools/integrations.tsのcall_external_api、authType別の認証設定を持つ別システム)
	// とは実装を完全に分離し、ここで直接HTTP呼び出しを行う。
	if (step.tool === 'call_external_api') {
		// connection_id相当。カタログのparamsには含めず、エディタの「対象」選択で直接 step.params に設定される
		const connectionId = step.params?.integration_id;
		if (!connectionId) throw new WorkflowAbortError(`「${step.label}」の連携先が選択されていません`);
		const connection = await getExternalApiConnection(db, connectionId);
		if (!connection) throw new WorkflowAbortError(`「${step.label}」の連携先が見つかりません（削除された可能性があります）`);

		const rawBodyStr = step.params?.['body'] ?? '';
		let body: Record<string, unknown> | undefined;
		if (rawBodyStr) {
			let parsedBody: Record<string, unknown>;
			try { parsedBody = JSON.parse(preQuoteReferences(rawBodyStr)); } catch { throw new WorkflowAbortError(`「${step.label}」のリクエストボディがJSON形式ではありません`); }
			body = resolveDataValues(parsedBody, results, itemStack, triggerContext, self, inputArgs);
		}

		const raw = await callExternalApiConnection(connection, {
			endpoint: resolvedParams['endpoint'] as string | undefined,
			method: resolvedParams['method'] as string,
			body
		});

		// スカラー結果は常にレスポンスボディ全体(coerceScalarResultがオブジェクトはJSON文字列化する)。
		// rawには分解前の値（オブジェクト/配列等）を保持し、参照側で`@step:<id>.<path>`によりフィールド・
		// 配列要素を辿る（result_path/list_pathのようなステップ定義時のフィールド抽出設定は廃止した。
		// 参照側でパス指定できるので、ステップ側で事前に決め打つ必要が無いため — 2026-07-22）。
		results.set(step.id, { ...coerceScalarResult(raw.body), raw: raw.body });

		return { result: `外部API呼び出し完了（ステータス: ${raw.status}）` };
	}

	let input: Record<string, unknown> = resolvedParams;
	if (step.tool === 'send_email') {
		if (!self.email) throw new WorkflowAbortError('送信先（自分のメールアドレス）が特定できません');
		input = { ...resolvedParams, to: self.email };
	} else if (step.tool === 'get_entities') {
		// entity_type_id はカタログのparamsに含めず、エディタの「対象」選択で直接 step.params に設定される
		const entityTypeId = step.params?.entity_type_id;
		if (!entityTypeId) throw new WorkflowAbortError(`「${step.label}」の対象テーブルが選択されていません`);
		input = { ...resolvedParams, entity_type_id: entityTypeId };
	} else if (step.tool === 'send_slack_notification') {
		// integration_id はカタログのparamsに含めず、エディタの「対象」選択で直接 step.params に設定される
		const integrationId = step.params?.integration_id;
		if (!integrationId) throw new WorkflowAbortError(`「${step.label}」のSlack連携先が選択されていません`);
		input = { ...resolvedParams, integration_id: integrationId };
	}

	const raw = await dispatchTool(db, step.tool as ToolName, input, env);

	if (toolDef.resultType && toolDef.extractResult) {
		results.set(step.id, { type: toolDef.resultType, value: toolDef.extractResult(raw) });
	}
	if (toolDef.listResult) {
		listResults.set(step.id, toolDef.listResult.extractList(raw));
	}
	return {};
}

async function runAction(
	db: Db,
	step: WorkflowActionStep,
	results: Map<string, StepResult>,
	listResults: ListResults,
	env: ToolEnv | undefined,
	self: SelfContext,
	itemStack: ItemStack,
	budget: Budget,
	triggerContext?: TriggerContext,
	inputArgs?: Record<string, unknown>
): Promise<{ result?: string; attempts: number }> {
	const toolDef = getWorkflowActionTool(step.tool);
	if (!toolDef) throw new WorkflowAbortError(`未対応のツールです: ${step.tool}`);

	const resolvedParams: Record<string, string | number> = {};
	for (const field of toolDef.params) {
		const raw = step.params?.[field.key];
		if (!raw) continue;
		const value = resolveOperand(raw, results, itemStack, triggerContext, self, inputArgs).value;
		if (field.type === 'number') {
			resolvedParams[field.key] = Number(value);
		} else if (field.type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
			// <input type="date"> の "YYYY-MM-DD" は new Date() でUTC深夜と解釈されJSTと9時間ズレるため、
			// JSTのウォールクロックとして明示的にオフセットを付与する（until は当日いっぱいを含めるため終端時刻にする）
			resolvedParams[field.key] = `${value}T${field.key === 'until' ? '23:59:59' : '00:00:00'}+09:00`;
		} else {
			resolvedParams[field.key] = String(value);
		}
	}

	// maxRetriesはユーザー入力なのでWORKFLOW_MAX_RETRIESで上限をクランプする（validateWorkflowで
	// 弾いているはずだが、AI生成データ等バリデーションを経由しない経路への防御として二重にチェックする）。
	const maxAttempts = 1 + Math.min(Math.max(step.maxRetries ?? 0, 0), WORKFLOW_MAX_RETRIES);
	let lastError: unknown;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		consumeBudget(budget);
		try {
			const { result } = await performAction(db, step, toolDef, resolvedParams, results, listResults, env, self, itemStack, triggerContext, inputArgs);
			return { result, attempts: attempt };
		} catch (e) {
			lastError = e;
			// 設定不備（対象未選択・JSON不正等）はリトライしても同じ結果になるだけなので即座に諦める。
			if (e instanceof WorkflowAbortError) break;
			if (attempt < maxAttempts) await sleep(WORKFLOW_RETRY_DELAY_MS);
		}
	}
	throw lastError;
}

/**
 * foreachのsourceを解決する。`@step:<id>`（パス無し）はget_entities等、静的にlistResultを持つ
 * アクションの一覧をそのまま使う。`@step:<id>.<path>`はcall_external_api等、rawを保持するステップの
 * 生の値からresolveJsonPathで配列を取り出す（result_path/list_pathの代わり。参照側でパスを指定できる
 * ので、ステップ側で事前に「一覧として取り出すフィールド」を決め打つ必要が無い — 2026-07-22）。
 */
function resolveForeachSource(
	stepRef: { id: string; path: string | null },
	label: string,
	results: Map<string, StepResult>,
	listResults: ListResults
): Record<string, unknown>[] {
	if (stepRef.path === null) {
		const items = listResults.get(stepRef.id);
		if (!items) throw new WorkflowAbortError(`「${label}」の参照先のリスト結果が見つかりません: ${stepRef.id}`);
		return items;
	}
	const found = results.get(stepRef.id);
	if (!found || found.raw === undefined) {
		throw new WorkflowAbortError(`「${label}」の参照先はフィールドを指定して参照できません（call_external_api以外は非対応）: ${stepRef.id}`);
	}
	const resolved = resolveJsonPath(found.raw, stepRef.path);
	if (!Array.isArray(resolved)) throw new WorkflowAbortError(`「${label}」の参照先は配列ではありません: ${stepRef.id}.${stepRef.path}`);
	return resolved.map((item) =>
		item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : { value: item }
	);
}

async function runForeach(
	db: Db,
	step: WorkflowForeachStep,
	results: Map<string, StepResult>,
	listResults: ListResults,
	env: ToolEnv | undefined,
	self: SelfContext,
	itemStack: ItemStack,
	budget: Budget,
	logs: StepLog[],
	triggerContext?: TriggerContext,
	inputArgs?: Record<string, unknown>
): Promise<void> {
	const stepRef = parseStepRef(step.source);
	if (!stepRef) throw new WorkflowAbortError(`「${step.label}」の対象が選択されていません`);
	const items = resolveForeachSource(stepRef, step.label, results, listResults);
	for (const item of items.slice(0, WORKFLOW_FOREACH_MAX_ITEMS)) {
		await runSteps(db, step.body, results, listResults, env, self, [...itemStack, { foreachStepId: step.id, item }], budget, logs, triggerContext, inputArgs);
	}
}

async function runSteps(
	db: Db,
	steps: WorkflowStep[],
	results: Map<string, StepResult>,
	listResults: ListResults,
	env: ToolEnv | undefined,
	self: SelfContext,
	itemStack: ItemStack = [],
	budget: Budget = { remaining: WORKFLOW_MAX_ACTIONS_PER_RUN },
	logs: StepLog[] = [],
	triggerContext?: TriggerContext,
	inputArgs?: Record<string, unknown>
): Promise<void> {
	for (const step of steps) {
		if (step.kind === 'action') {
			const start = Date.now();
			try {
				const { result, attempts } = await runAction(db, step, results, listResults, env, self, itemStack, budget, triggerContext, inputArgs);
				logs.push({ id: step.id, label: step.label, ok: true, result, ms: Date.now() - start, ...(attempts > 1 ? { attempts } : {}) });
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				logs.push({ id: step.id, label: step.label, ok: false, error, ms: Date.now() - start, ...(step.continueOnError ? { continued: true } : {}) });
				if (step.continueOnError) continue;
				throw e;
			}
		} else if (step.kind === 'condition') {
			const start = Date.now();
			let matched: boolean;
			try {
				const left = resolveOperand(step.left, results, itemStack, triggerContext, self, inputArgs);
				const right = resolveOperand(step.right, results, itemStack, triggerContext, self, inputArgs);
				matched = compare(left, step.operator, right);
			} catch (e) {
				const error = e instanceof Error ? e.message : String(e);
				logs.push({ id: step.id, label: step.label, ok: false, error, ms: Date.now() - start });
				throw e;
			}
			if (matched) {
				await runSteps(db, step.then, results, listResults, env, self, itemStack, budget, logs, triggerContext, inputArgs);
			}
		} else {
			await runForeach(db, step, results, listResults, env, self, itemStack, budget, logs, triggerContext, inputArgs);
		}
	}
}

export type WorkflowRunResult = { id: string; name: string; ok: boolean; error?: string };

const WORKFLOW_RUN_LOCK_PREFIX = 'workflow-run-lock:';
/**
 * ロックの取り忘れ（異常終了等）に備えたフェイルセーフのTTL。通常は実行完了時にreleaseRunLockで即時解放する。
 * WORKFLOW_MAX_ACTIONS_PER_RUN（外部API呼び出し等を含みうる）を余裕を持ってカバーできる値にする
 * （短すぎると、正常実行中でもTTL満了により別プロセスがロックを取得できてしまう）。
 */
const WORKFLOW_RUN_LOCK_TTL_SECONDS = 600;

/**
 * 「今すぐ実行」とCron tickが同じワークフローを同時に実行してしまう（通知の重複送信等）のを防ぐ、
 * KVを使ったベストエフォートのロック。KVはアトミックなcompare-and-swapを提供しないため完全な排他制御ではないが、
 * 実用上の同時実行（同じ分の重複発火・連打）はこれで十分防げる。KV未設定（ローカル開発等）の場合は実行を許可する。
 */
async function acquireRunLock(kv: KVNamespace | undefined, workflowId: string): Promise<boolean> {
	if (!kv) return true;
	const key = `${WORKFLOW_RUN_LOCK_PREFIX}${workflowId}`;
	if (await kv.get(key)) return false;
	await kv.put(key, '1', { expirationTtl: WORKFLOW_RUN_LOCK_TTL_SECONDS });
	return true;
}

async function releaseRunLock(kv: KVNamespace | undefined, workflowId: string): Promise<void> {
	if (!kv) return;
	await kv.delete(`${WORKFLOW_RUN_LOCK_PREFIX}${workflowId}`);
}

async function executeWorkflow(db: Db, workflow: WorkflowRow, env?: ToolEnv, triggerContext?: TriggerContext, inputArgs?: Record<string, unknown>): Promise<WorkflowRunResult> {
	if (!(await acquireRunLock(env?.KV, workflow.id))) {
		return {
			id: workflow.id,
			name: workflow.name,
			ok: false,
			error: '他の処理がこのワークフローを実行中のため今回はスキップしました。しばらく待ってから再度お試しください'
		};
	}
	const startedAt = new Date();
	const logs: StepLog[] = [];
	try {
		const account = workflow.accountId ? await getAccount(db, workflow.accountId) : null;
		// send_notification 等、env.accountId を「通知・登録の宛先」として参照するツールのために、
		// ワークフローの登録者をこの実行スコープのアカウントとして引き渡す
		const toolEnv: ToolEnv | undefined = workflow.accountId
			? { ...(env ?? {}), accountId: workflow.accountId }
			: env;
		const self: SelfContext = { email: account?.email ?? null, accountId: workflow.accountId ?? null };
		await runSteps(db, workflow.steps, new Map(), new Map(), toolEnv, self, [], { remaining: WORKFLOW_MAX_ACTIONS_PER_RUN }, logs, triggerContext, inputArgs);
		await recordWorkflowRun(db, { workflowId: workflow.id, ok: true, log: logs, startedAt, finishedAt: new Date() });
		return { id: workflow.id, name: workflow.name, ok: true };
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		await recordWorkflowRun(db, { workflowId: workflow.id, ok: false, error, log: logs, startedAt, finishedAt: new Date() });
		return { id: workflow.id, name: workflow.name, ok: false, error };
	} finally {
		await releaseRunLock(env?.KV, workflow.id);
	}
}

/** 毎分のCronから呼ばれる。現在のJST時刻に一致する有効なスケジュールワークフローを実行する。 */
export async function processDueWorkflows(
	db: Db,
	env?: ToolEnv,
	now: Date = new Date()
): Promise<WorkflowRunResult[]> {
	const { hour, minute } = getJstHourMinute(now);
	const due = (await getEnabledWorkflows(db)).filter(
		(w) => w.triggerType === 'schedule' && w.triggerHour === hour && w.triggerMinute === minute
	);
	return Promise.all(due.map((workflow) => executeWorkflow(db, workflow, env)));
}

/**
 * 「今すぐ実行」用。トリガー時刻・有効化フラグを無視し、DBに保存されている内容をそのまま即時実行する
 * （編集中の画面上の未保存の内容ではない）。テスト目的の手動実行またはイベントトリガーによる自動実行。
 */
export async function runWorkflowNow(db: Db, workflowId: string, env?: ToolEnv, triggerContext?: TriggerContext, inputArgs?: Record<string, unknown>): Promise<WorkflowRunResult> {
	const workflow = await getWorkflow(db, workflowId);
	if (!workflow) throw new Error('ワークフローが見つかりません');
	return executeWorkflow(db, workflow, env, triggerContext, inputArgs);
}
