// ワークフローの「アクション」ステップで選択できるツールのカタログ。
// クライアント（編集UI）・サーバー（実行エンジン）の両方から参照するため、DB等のサーバー専用依存は持たない。
import type { WorkflowResultType } from './types/chat';

export type WorkflowParamField = {
	key: string;
	label: string;
	type: 'text' | 'textarea' | 'number' | 'select' | 'date';
	required?: boolean;
	/** type: 'select' の場合の選択肢 */
	options?: { value: string; label: string }[];
};

export type WorkflowListResultField = { key: string; label: string };

/** foreachのsourceとして参照できる、配列形式の結果。 */
export type WorkflowListResultDef = {
	desc: string;
	/** body内で `@item:<key>` として参照できるフィールド一覧（UI・AIへの案内に使う） */
	itemFields: WorkflowListResultField[];
	/** ツールの生の戻り値から一覧（オブジェクトの配列）を取り出す */
	extractList: (raw: unknown) => Record<string, unknown>[];
};

export type WorkflowActionToolDef = {
	value: string;
	label: string;
	/** ユーザーが入力するパラメータ（自動補完される値、例: send_email の to は含めない） */
	params: WorkflowParamField[];
	/** 条件・他ステップの引数から参照可能なスカラー結果を返す場合に指定する */
	resultType?: WorkflowResultType;
	resultDesc?: string;
	/** ツールの生の戻り値からスカラー結果を取り出す（resultType指定時は必須） */
	extractResult?: (raw: unknown) => boolean | number | string;
	/** foreachのsourceとして使える配列結果を返す場合に指定する（resultTypeと併用可） */
	listResult?: WorkflowListResultDef;
	/** AIへの説明文に添える補足（自動補完される値の説明など）。UI上には表示しない */
	note?: string;
};

export const WORKFLOW_ACTION_TOOLS: WorkflowActionToolDef[] = [
	{
		value: 'send_email',
		label: 'メール送信（自分宛て）',
		params: [
			{ key: 'subject', label: '件名', type: 'text', required: true },
			{ key: 'body', label: '本文', type: 'textarea', required: true }
		],
		note: '宛先は自動でユーザー自身のメールアドレスになる（to パラメータは不要）'
	},
	{
		value: 'send_notification',
		label: '通知センターに通知',
		params: [
			{ key: 'title', label: 'タイトル', type: 'text', required: true },
			{ key: 'body', label: '本文', type: 'textarea', required: true }
		],
		note: '通知先は自動でワークフローの登録者になる'
	},
	{
		value: 'send_slack_notification',
		label: 'Slackに通知',
		params: [{ key: 'body', label: '本文', type: 'textarea', required: true }],
		note: '宛先は「対象」で選択したSlack連携固定（integration_idは対象選択で直接設定されるため、AIがparamsで指定することはできない）'
	},
	{
		value: 'get_entities',
		label: '自作テーブルを検索',
		params: [{ key: 'limit', label: '取得件数の上限', type: 'number' }],
		resultType: 'number',
		resultDesc: '該当するレコードの件数',
		extractResult: (raw) => (Array.isArray(raw) ? raw.length : 0),
		note: '対象テーブルは「対象」の選択で決まる（個々のカスタムテーブルが対象の選択肢に並ぶ。entity_type_idを直接paramsで指定することはできない）',
		listResult: {
			desc: '該当するレコードの一覧（foreachで1件ずつ処理する場合に使う）',
			// テーブルごとに実際のフィールドは異なるため、ここは器のみ。UI・検証では entityListItemFields() で
			// このステップの entity_type_id から動的に解決した一覧を使う（このitemFieldsはフォールバック用）。
			itemFields: [{ key: 'id', label: 'ID' }],
			extractList: (raw) =>
				Array.isArray(raw)
					? (raw as { id: string; data?: Record<string, unknown> }[]).map((r) => ({
							id: r.id,
							...(r.data ?? {})
						}))
					: []
		}
	},
	{
		value: 'create_entity',
		label: '自作テーブルにレコード作成',
		params: [{ key: 'data', label: 'フィールド値（JSON形式）', type: 'textarea', required: true }],
		note: '対象テーブルは「対象」の選択で決まる。dataはフィールドキーと値のJSONオブジェクト（例: {"name":"田中","status":"active"}）'
	},
	{
		value: 'update_entity',
		label: '自作テーブルのレコードを更新',
		params: [
			{ key: 'id', label: 'レコードID', type: 'text', required: true },
			{ key: 'data', label: '更新フィールド値（JSON形式）', type: 'textarea', required: true }
		],
		note: '対象テーブルは「対象」の選択で決まる。idは更新対象のレコードID（@item:idなど）、dataは更新するフィールドキーと値のJSONオブジェクト'
	},
	{
		value: 'delete_entity',
		label: '自作テーブルのレコードを削除',
		params: [{ key: 'id', label: 'レコードID', type: 'text', required: true }],
		note: '対象テーブルは「対象」の選択で決まる。idは削除対象のレコードID'
	},
	{
		value: 'call_external_api',
		label: '外部APIを呼び出す',
		params: [
			{ key: 'endpoint', label: 'エンドポイント（パスまたはURL）', type: 'text', required: true },
			{
				key: 'method',
				label: 'HTTPメソッド',
				type: 'select',
				required: true,
				options: [
					{ value: 'GET', label: 'GET' },
					{ value: 'POST', label: 'POST' },
					{ value: 'PUT', label: 'PUT' },
					{ value: 'PATCH', label: 'PATCH' },
					{ value: 'DELETE', label: 'DELETE' }
				]
			},
			{ key: 'body', label: 'リクエストボディ（JSON形式、任意）', type: 'textarea' }
		],
		resultType: 'boolean',
		resultDesc: '呼び出しが成功したか（HTTPステータスが2xx）',
		extractResult: (raw) => !!(raw as { ok?: boolean } | undefined)?.ok,
		note: '呼び出し先は「対象」の選択で決まる（設定済みの外部API連携。integration_idは対象選択で直接設定されるため、AIがparamsで指定することはできない）'
	}
];

export function getWorkflowActionTool(tool: string): WorkflowActionToolDef | undefined {
	return WORKFLOW_ACTION_TOOLS.find((t) => t.value === tool);
}

export type WorkflowActionCategoryTarget = { value: string; label: string; tool: string };

export type WorkflowActionCategory = {
	key: string;
	label: string;
	targets: WorkflowActionCategoryTarget[];
	/** trueの場合、各カスタムテーブル（entity_type）が対象の選択肢に追加される */
	includeEntityTargets?: boolean;
	/** includeEntityTargets時に使用するツール（未指定はget_entities） */
	entityTargetTool?: string;
	/** trueの場合、設定済みのSlack連携（Incoming Webhook）が個別の対象選択肢として追加される（send_slack_notification固定） */
	includeSlackTargets?: boolean;
	/** trueの場合、設定済みの外部API連携が個別の対象選択肢として追加される（call_external_api固定） */
	includeIntegrationTargets?: boolean;
};

/**
 * エディタ上で「カテゴリ→対象」の2段階選択にするためのグルーピング。
 * カタログ（WORKFLOW_ACTION_TOOLS）自体は変更せず、その上に被せる表示用の構造。
 * 対象の選択肢が増えるたびにツール一覧がフラットに増え続けるのを避けるため。
 */
export const WORKFLOW_ACTION_CATEGORIES: WorkflowActionCategory[] = [
	{
		key: 'notify',
		label: '通知',
		targets: [
			{ value: 'notification', label: '通知センター', tool: 'send_notification' },
			{ value: 'email', label: 'メール', tool: 'send_email' }
		],
		includeSlackTargets: true
	},
	{
		key: 'search',
		label: '検索',
		targets: [],
		includeEntityTargets: true
	},
	{
		key: 'data_create',
		label: 'データ作成',
		targets: [],
		includeEntityTargets: true,
		entityTargetTool: 'create_entity'
	},
	{
		key: 'data_update',
		label: 'データ更新',
		targets: [],
		includeEntityTargets: true,
		entityTargetTool: 'update_entity'
	},
	{
		key: 'data_delete',
		label: 'データ削除',
		targets: [],
		includeEntityTargets: true,
		entityTargetTool: 'delete_entity'
	},
	{
		key: 'external_api',
		label: '外部API',
		targets: [],
		includeIntegrationTargets: true
	}
];

export function findWorkflowActionCategory(tool: string): WorkflowActionCategory | undefined {
	if (tool === 'get_entities') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.includeEntityTargets && !c.entityTargetTool);
	if (tool === 'create_entity') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.entityTargetTool === 'create_entity');
	if (tool === 'update_entity') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.entityTargetTool === 'update_entity');
	if (tool === 'delete_entity') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.entityTargetTool === 'delete_entity');
	if (tool === 'send_slack_notification') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.includeSlackTargets);
	if (tool === 'call_external_api') return WORKFLOW_ACTION_CATEGORIES.find((c) => c.includeIntegrationTargets);
	return WORKFLOW_ACTION_CATEGORIES.find((c) => c.targets.some((t) => t.tool === tool));
}

/**
 * get_entitiesステップのforeach用itemFieldsを、選択中のテーブルの実際のフィールド定義から動的に組み立てる。
 * カタログ（WORKFLOW_ACTION_TOOLS）はテーブルごとの違いを知らないため、entityTypesを使ってここで解決する。
 * 常に id を先頭に含む。
 */
export function entityListItemFields(
	entityTypes: { id: string; fields: WorkflowListResultField[] }[],
	entityTypeId: string | undefined
): WorkflowListResultField[] {
	const idField: WorkflowListResultField = { key: 'id', label: 'ID' };
	const match = entityTypes.find((e) => e.id === entityTypeId);
	return match ? [idField, ...match.fields] : [idField];
}

const RESULT_TYPE_LABELS: Record<WorkflowResultType, string> = {
	boolean: '真偽値',
	number: '数値',
	string: '文字列'
};

/** AIへのシステムプロンプトに埋め込む、カタログ1件分の説明文を生成する。 */
export function describeWorkflowActionToolForAI(t: WorkflowActionToolDef): string {
	const paramsDesc =
		t.params.length > 0
			? JSON.stringify(Object.fromEntries(t.params.map((p) => [p.key, p.label])))
			: 'params不要';
	const resultDesc = t.resultType
		? `、結果は${RESULT_TYPE_LABELS[t.resultType]}${t.resultDesc ? `（${t.resultDesc}）` : ''}`
		: '';
	const noteDesc = t.note ? `※${t.note}` : '';
	const listDesc = t.listResult
		? `。foreachのsourceとして一覧（${t.listResult.desc}）も取得可能。body内では ${t.listResult.itemFields.map((f) => `@item:${f.key}（${f.label}）`).join(' / ')} が参照できる`
		: '';
	return `- \`${t.value}\`（${t.label}${resultDesc}）: params = ${paramsDesc}${noteDesc ? ` ${noteDesc}` : ''}${listDesc}`;
}

export const WORKFLOW_OPERATORS: { value: string; label: string }[] = [
	{ value: '==', label: '＝' },
	{ value: '!=', label: '≠' },
	{ value: '>', label: '＞' },
	{ value: '<', label: '＜' },
	{ value: '>=', label: '≧' },
	{ value: '<=', label: '≦' }
];

const STEP_REF_PREFIX = '@step:';

export function makeStepRef(id: string): string {
	return `${STEP_REF_PREFIX}${id}`;
}

export function parseStepRef(value: string | undefined): string | null {
	if (!value || !value.startsWith(STEP_REF_PREFIX)) return null;
	return value.slice(STEP_REF_PREFIX.length);
}

const ITEM_REF_PREFIX = '@item:';

export type ParsedItemRef = { foreachStepId: string | null; field: string };

/**
 * foreachのbody内で、現在処理中の項目のフィールドを参照する記法（`@item:<foreachのid>:<field>`）。
 * foreachStepIdを指定することで、ネストしたforeachのどちらの項目を指すかを区別する（エディタは常にこの形式で保存する）。
 * foreachStepIdを省略した旧形式（`@item:<field>`）はparseItemRefで読めるが、最も内側のforeachを指すものとして解釈する。
 */
export function makeItemRef(foreachStepId: string, field: string): string {
	return `${ITEM_REF_PREFIX}${foreachStepId}:${field}`;
}

export function parseItemRef(value: string | undefined): ParsedItemRef | null {
	if (!value || !value.startsWith(ITEM_REF_PREFIX)) return null;
	const rest = value.slice(ITEM_REF_PREFIX.length);
	const sep = rest.indexOf(':');
	if (sep === -1) return { foreachStepId: null, field: rest };
	return { foreachStepId: rest.slice(0, sep), field: rest.slice(sep + 1) };
}

const TRIGGER_REF_PREFIX = '@trigger:';

/**
 * イベントトリガーで操作されたレコードのフィールドを参照する記法（`@trigger:<field>`）。
 * id/event（レコードID・イベント種別）に加え、createdBy等のシステムフィールドやテーブル固有フィールドを指す。
 */
export function makeTriggerRef(field: string): string {
	return `${TRIGGER_REF_PREFIX}${field}`;
}

export function parseTriggerRef(value: string | undefined): string | null {
	if (!value || !value.startsWith(TRIGGER_REF_PREFIX)) return null;
	return value.slice(TRIGGER_REF_PREFIX.length);
}

const INPUT_REF_PREFIX = '@input:';

/** ワークフローで宣言された入力パラメータ（inputSchema）を参照する記法（`@input:<key>`）。 */
export function makeInputRef(key: string): string {
	return `${INPUT_REF_PREFIX}${key}`;
}

export function parseInputRef(value: string | undefined): string | null {
	if (!value || !value.startsWith(INPUT_REF_PREFIX)) return null;
	return value.slice(INPUT_REF_PREFIX.length);
}

/**
 * イベントトリガーの対象レコードで、テーブルのフィールド定義に関わらず常に参照できるシステムフィールド。
 * キーは RecordRow（table-service.getRecord）が実際に返すキー名（createdBy等のキャメルケース）に合わせる。
 */
export const TRIGGER_SYSTEM_FIELDS: WorkflowListResultField[] = [
	{ key: 'id', label: 'レコードID' },
	{ key: 'event', label: 'イベント種別（create/update/delete）' },
	{ key: 'createdBy', label: '作成者のアカウントID' },
	{ key: 'updatedBy', label: '更新者のアカウントID' },
	{ key: 'createdAt', label: '作成日時' },
	{ key: 'updatedAt', label: '更新日時' }
];

/**
 * イベントトリガーのstep1条件等で選択できる「トリガーレコードのフィールド」一覧を組み立てる。
 * システムフィールド（id/event/createdBy等）に、選択中のトリガー対象テーブルのカスタムフィールドを加える。
 */
export function triggerFieldsFor(
	entityTypes: { id: string; fields: WorkflowListResultField[] }[],
	triggerEntityTypeId: string | null | undefined
): WorkflowListResultField[] {
	const match = entityTypes.find((e) => e.id === triggerEntityTypeId);
	return [...TRIGGER_SYSTEM_FIELDS, ...(match?.fields ?? [])];
}

/** ワークフロー登録者自身のアカウントIDを参照する記法。createdBy等と比較して「自分が行った操作か」を判定するのに使う。 */
export const SELF_ACCOUNT_ID_REF = '@self:account_id';
