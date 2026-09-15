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
 * Determines whether a field is a relation-type field that references another record by id, while
 * showing a label (name) in the display/choices.
 * - recordSelect: references an arbitrary user-defined table
 * - account: a dedicated type that references the accounts table. Fixed to refTable='accounts' / refLabelKey='name'
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
	entity?: string;
	submitLabel?: string;
	completed?: boolean;
};

export type TableContent = {
	type: 'table';
	columns: TableColumn[];
	rows: Record<string, unknown>[];
	// When rows represent records of a table, the name of that custom table.
	// If set, clicking a row can open a detail dialog (rows need an id)
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
 * A parameter/condition operand value. Either a string literal as-is, or a reference via `@step:<id>`
 * notation to the result of a preceding step (WorkflowActionStep) within the same workflow.
 */
export type WorkflowOperand = string;

export type WorkflowActionStep = {
	id: string;
	kind: 'action';
	label: string;
	tool: string;
	params?: Record<string, WorkflowOperand>;
	/** The category key chosen via the editor's "category -> target" selection (e.g. 'search' / 'summarize').
	 *  Remembers which category to display under on reload, for tools referenced from multiple categories.
	 *  If unset (AI-generated or legacy data), falls back to a reverse lookup via findWorkflowActionCategory. */
	category?: string;
	/** Number of automatic retries on failure (0 or unset = no retry). WORKFLOW_MAX_RETRIES is the cap.
	 *  Immediate-abort errors from misconfiguration etc. (WorkflowAbortError) are not retried — only transient failures are assumed. */
	maxRetries?: number;
	/** If true, proceed to the next step instead of aborting the whole workflow when this step ultimately fails even after retries. */
	continueOnError?: boolean;
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
 * Processes an array-shaped result (an action with a listResult) one item at a time. There is no
 * while-equivalent construct, to avoid infinite loops. Inside body, the current item can be referenced
 * as `@item:<field>` (a body-only scope; not referenceable from outside).
 */
export type WorkflowForeachStep = {
	id: string;
	kind: 'foreach';
	label: string;
	source: WorkflowOperand;
	body: WorkflowStep[];
};

export type WorkflowResultValueType = 'scalar' | 'array';

/**
 * Sets a key on the workflow's overall execution result (the run_workflow_* MCP response, the "run now"
 * result display). Setting the same key more than once overwrites it with the value from whichever ran later.
 * When valueType is 'array', value is a JSON.stringify'd string array (each element is either a @step:/@item:
 * etc. reference or a literal). Object types (nesting) are currently unsupported.
 */
export type WorkflowResultStep = {
	id: string;
	kind: 'result';
	label: string;
	key: string;
	valueType: WorkflowResultValueType;
	value: WorkflowOperand;
};

export type WorkflowStep = WorkflowActionStep | WorkflowConditionStep | WorkflowForeachStep | WorkflowResultStep;

export type WorkflowContent = {
	type: 'workflow';
	id?: string;
	name: string;
	triggerType: 'schedule' | 'event' | 'mcp_tool';
	triggerHour: number;
	triggerMinute: number;
	triggerEvent: 'create' | 'update' | 'delete' | null;
	triggerEntityTypeId: string | null;
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
