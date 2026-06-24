// ── Polling ────────────────────────────────────────────────────────────────
export const NOTIFICATION_POLL_INTERVAL_MS = 15000;

// ── Chat ───────────────────────────────────────────────────────────────────
export const CHAT_TITLE_MAX_LENGTH = 24;
export const CHAT_TEXTAREA_MAX_HEIGHT_PX = 192;

// ── Lists ──────────────────────────────────────────────────────────────────
// 一覧表示の1ページあたり件数（チャットの Table・/database 一覧で共通）
export const LIST_PAGE_SIZE = 20;

// ── Deal statuses ─────────────────────────────────────────────────────────
export const DEAL_STATUS_IDS = ['open', 'won', 'lost'] as const;

// ── Health score ──────────────────────────────────────────────────────────
export const HEALTH_LEVEL_COLORS: Record<string, string> = {
	excellent: '#16a34a',
	good: '#2563eb',
	fair: '#d97706',
	poor: '#dc2626'
};

// ── Approval statuses ─────────────────────────────────────────────────────
export const APPROVAL_STATUS_COLORS: Record<string, string> = {
	pending: '#d97706',
	approved: '#16a34a',
	rejected: '#dc2626',
	cancelled: '#6b7280'
};

// ── Reminder statuses ─────────────────────────────────────────────────────
export const REMINDER_STATUS_COLORS: Record<string, string> = {
	pending: '#d97706',
	sent: '#16a34a',
	failed: '#dc2626'
};

// ── Session / KV ──────────────────────────────────────────────────────────
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const DOCUMENT_JOB_TTL_SECONDS = 3600;

// ── Rate limits ───────────────────────────────────────────────────────────
export const FORGOT_PASSWORD_RATE_LIMIT = 5;
export const FORGOT_PASSWORD_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ── DB query limits ───────────────────────────────────────────────────────
export const DEFAULT_LIST_LIMIT = 50;
export const DEFAULT_ACTIVITY_LIST_LIMIT = 20;
export const CUSTOMER_DETAIL_ACTIVITY_LIMIT = 10;
export const HEALTH_RANKING_DEFAULT_LIMIT = 5;

// ── ワークフロー ───────────────────────────────────────────────────────────
/** foreachステップが1回の実行で処理する最大件数（暴走防止のセーフティキャップ） */
export const WORKFLOW_FOREACH_MAX_ITEMS = 50;
/** ネストしたforeachの組み合わせ爆発を防ぐため、1回の実行（cron/今すぐ実行）で許容するアクション実行回数の総量上限 */
export const WORKFLOW_MAX_ACTIONS_PER_RUN = 500;
