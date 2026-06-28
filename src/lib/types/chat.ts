export type FieldType =
	| 'text'
	| 'email'
	| 'tel'
	| 'number'
	| 'textarea'
	| 'select'
	| 'date'
	| 'datetime-local'
	| 'timestamp'
	| 'hidden'
	| 'recordSelect'
	| 'account'
	| 'multiselect';

/**
 * 他レコードを id で参照し、表示・選択肢ではラベル（名前）を見せるリレーション系フィールドか判定する。
 * - recordSelect: 任意のユーザー定義テーブルを参照
 * - account: アカウントテーブル（accounts）を参照する専用型。refTable='accounts' / refLabelKey='name' 固定
 */
export function isRefField(type: string): boolean {
	return type === 'recordSelect' || type === 'account';
}

export type FormField = {
	key: string;
	label: string;
	type: FieldType;
	required?: boolean;
	placeholder?: string;
	value?: string;
	options?: { label: string; value: string }[];
	refTable?: string;
};

export type TableColumn = {
	key: string;
	label: string;
};

export type TextContent = {
	type: 'text';
	text: string;
};

export type FormContent = {
	type: 'form';
	title?: string;
	fields: FormField[];
	tool: string;
	entity?: string; // カスタムテーブル等を RecordDialog で開く場合にテーブル種別を指定
	submitLabel?: string;
	completed?: boolean;
};

export type TableContent = {
	type: 'table';
	columns: TableColumn[];
	rows: Record<string, unknown>[];
	// 行がレコードを表すテーブルの場合、そのカスタムテーブル名。
	// 設定されていると行クリックで詳細ダイアログを開ける（rows に id が必要）
	entity?: string;
};

export type ValueFormat = 'currency' | 'number' | 'date' | 'datetime' | 'text';

export type ValueItem = {
	label: string;
	value: string | number | null;
	format: ValueFormat;
};

export type ValuesContent = {
	type: 'values';
	title?: string;
	items: ValueItem[];
};


export type LinkContent = {
	type: 'link';
	label: string;
	href: string;
	description?: string;
	newTab?: boolean;
};

export type DocumentJobContent = {
	type: 'document_job';
	jobId: string;
	label: string;
};

export type DocHandoffContent = {
	type: 'doc_handoff';
	label: string;
	downloadUrl: string;
	filename: string;
	prompt: string;
};

export type ReplyOption = {
	value: string;
	label: string;
};

export type ReplyField = {
	key: string;
	type: 'single' | 'multiple' | 'text' | 'textarea' | 'number' | 'datetime';
	label?: string;
	required?: boolean;
	options?: ReplyOption[];
	placeholder?: string;
};

export type ReplyContent = {
	type: 'reply';
	title?: string;
	fields: ReplyField[];
	submitLabel?: string;
	completed?: boolean;
};

export type WorkflowResultType = 'boolean' | 'number' | 'string';

/**
 * パラメータ・条件のオペランド値。文字列リテラルそのもの、または `@step:<id>` 形式で
 * 同じワークフロー内の先行ステップ（WorkflowActionStep）の結果を参照する。
 */
export type WorkflowOperand = string;

export type WorkflowActionStep = {
	id: string;
	kind: 'action';
	label: string;
	tool: string;
	params?: Record<string, WorkflowOperand>;
	/** エディタの「カテゴリ→対象」選択で選んだカテゴリキー（例: 'search' / 'summarize'）。
	 *  toolが複数カテゴリから参照される場合に、再読込時どちらのカテゴリで表示するかを覚えておくため。
	 *  未設定（AI生成・旧データ）の場合は findWorkflowActionCategory による逆引きにフォールバックする。 */
	category?: string;
};

export type WorkflowConditionOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';

export type WorkflowConditionStep = {
	id: string;
	kind: 'condition';
	label: string;
	left: WorkflowOperand;
	operator: WorkflowConditionOperator;
	right: WorkflowOperand;
	then: WorkflowStep[];
};

/**
 * 配列型の結果（resultListを持つアクション）を1件ずつ処理する。無限ループ回避のため
 * while相当の仕組みは提供しない。body内では現在の項目を `@item:<field>` で参照できる
 * （body専用スコープ。外からは参照不可）。
 */
export type WorkflowForeachStep = {
	id: string;
	kind: 'foreach';
	label: string;
	source: WorkflowOperand;
	body: WorkflowStep[];
};

export type WorkflowStep = WorkflowActionStep | WorkflowConditionStep | WorkflowForeachStep;

export type WorkflowContent = {
	type: 'workflow';
	id?: string;
	name: string;
	triggerHour: number;
	triggerMinute: number;
	steps: WorkflowStep[];
};

export type MessageContent =
	| TextContent
	| FormContent
	| TableContent
	| ValuesContent
	| LinkContent
	| DocumentJobContent
	| DocHandoffContent
	| ReplyContent
	| WorkflowContent;

export type Message = {
	id: string;
	role: 'user' | 'assistant';
	contents: MessageContent[];
	createdAt: Date;
};
