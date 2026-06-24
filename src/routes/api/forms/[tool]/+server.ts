import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { getReminderChannelOptions } from '$lib/server/db/reminder-service';
import type { FormField } from '$lib/types/chat';
import type { ToolEnv } from '$lib/server/mcp';

const DEAL_STATUS_OPTIONS = [
	{ label: '商談中', value: 'open' },
	{ label: '受注', value: 'won' },
	{ label: '失注', value: 'lost' }
];

const ACTIVITY_TYPE_OPTIONS = [
	{ label: 'メモ', value: 'note' },
	{ label: '電話', value: 'call' },
	{ label: 'メール', value: 'email' },
	{ label: '面談', value: 'meeting' }
];

// 既知のツールに対するサーバー定義フォームを返す。
// FormDialog はこのエンドポイントからフィールド構造を取得し、AIが提供した値をプリフィルとして適用する。
export const GET: RequestHandler = async ({ params, platform, locals }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'DB not configured' }, { status: 500 });
	}

	const db = createDb(platform.env.DB);
	const toolEnv: ToolEnv = {
		...platform.env,
		accountId: locals.account?.id,
		accountName: locals.account?.name
	};

	const { tool } = params;

	// ── リマインダー ──────────────────────────────────────────────
	if (tool === 'create_reminder') {
		const options = await getReminderChannelOptions(db, toolEnv);
		const fields: FormField[] = [
			{ key: 'remind_at', label: '日時', type: 'datetime-local', required: true },
			{ key: 'channels', label: '通知先', type: 'multiselect', required: true, value: 'notification', options },
			{ key: 'content', label: '内容', type: 'textarea', required: true }
		];
		return json({ title: 'リマインダー設定', fields });
	}

	// ── 顧客 ─────────────────────────────────────────────────────
	if (tool === 'create_customer') {
		const fields: FormField[] = [
			{ key: 'name', label: '会社名', type: 'text', required: true },
			{ key: 'email', label: 'メールアドレス', type: 'email' },
			{ key: 'phone', label: '電話番号', type: 'tel' },
			{ key: 'postal_code', label: '郵便番号', type: 'text' },
			{ key: 'address', label: '住所', type: 'text' },
			{ key: 'website', label: 'ホームページ', type: 'text' },
			{
				key: 'status',
				label: 'ステータス',
				type: 'select',
				value: 'active',
				options: [
					{ label: '有効', value: 'active' },
					{ label: '無効', value: 'inactive' }
				]
			},
			{ key: 'notes', label: '備考', type: 'textarea' }
		];
		return json({ title: '顧客情報登録', fields });
	}

	if (tool === 'update_customer') {
		const fields: FormField[] = [
			{ key: 'id', label: '', type: 'hidden' },
			{ key: 'name', label: '会社名', type: 'text', required: true },
			{ key: 'email', label: 'メールアドレス', type: 'email' },
			{ key: 'phone', label: '電話番号', type: 'tel' },
			{ key: 'postal_code', label: '郵便番号', type: 'text' },
			{ key: 'address', label: '住所', type: 'text' },
			{ key: 'website', label: 'ホームページ', type: 'text' },
			{
				key: 'status',
				label: 'ステータス',
				type: 'select',
				options: [
					{ label: '有効', value: 'active' },
					{ label: '無効', value: 'inactive' }
				]
			},
			{ key: 'notes', label: '備考', type: 'textarea' }
		];
		return json({ title: '顧客情報編集', fields });
	}

	// ── 案件 ─────────────────────────────────────────────────────
	if (tool === 'create_deal') {
		const fields: FormField[] = [
			{ key: 'customer_id', label: '顧客', type: 'recordSelect', required: true, refTable: 'customers' },
			{ key: 'title', label: '案件タイトル', type: 'text', required: true },
			{ key: 'amount', label: '金額（円）', type: 'number' },
			{ key: 'status', label: 'ステータス', type: 'select', value: 'open', options: DEAL_STATUS_OPTIONS },
			{ key: 'planned_start', label: '開始予定日', type: 'date' },
			{ key: 'planned_end', label: '終了予定日', type: 'date' },
			{ key: 'notes', label: '備考', type: 'textarea' }
		];
		return json({ title: '案件登録', fields });
	}

	if (tool === 'update_deal') {
		const fields: FormField[] = [
			{ key: 'id', label: '', type: 'hidden' },
			{ key: 'customer_id', label: '', type: 'hidden' },
			{ key: 'title', label: '案件タイトル', type: 'text', required: true },
			{ key: 'amount', label: '金額（円）', type: 'number' },
			{ key: 'status', label: 'ステータス', type: 'select', options: DEAL_STATUS_OPTIONS },
			{ key: 'planned_start', label: '開始予定日', type: 'date' },
			{ key: 'planned_end', label: '終了予定日', type: 'date' },
			{ key: 'notes', label: '備考', type: 'textarea' }
		];
		return json({ title: '案件編集', fields });
	}

	// ── 担当者 ───────────────────────────────────────────────────
	if (tool === 'create_contact') {
		const fields: FormField[] = [
			{ key: 'customer_id', label: '顧客', type: 'recordSelect', required: true, refTable: 'customers' },
			{ key: 'name', label: '氏名', type: 'text', required: true },
			{ key: 'name_kana', label: '氏名（カナ）', type: 'text' },
			{ key: 'role', label: '役職', type: 'text' },
			{ key: 'department', label: '部署', type: 'text' },
			{ key: 'email', label: 'メールアドレス', type: 'email' },
			{ key: 'phone', label: '電話番号', type: 'tel' },
			{ key: 'notes', label: '備考', type: 'textarea' }
		];
		return json({ title: '担当者登録', fields });
	}

	if (tool === 'update_contact') {
		const fields: FormField[] = [
			{ key: 'id', label: '', type: 'hidden' },
			{ key: 'customer_id', label: '', type: 'hidden' },
			{ key: 'name', label: '氏名', type: 'text', required: true },
			{ key: 'name_kana', label: '氏名（カナ）', type: 'text' },
			{ key: 'role', label: '役職', type: 'text' },
			{ key: 'department', label: '部署', type: 'text' },
			{ key: 'email', label: 'メールアドレス', type: 'email' },
			{ key: 'phone', label: '電話番号', type: 'tel' },
			{ key: 'notes', label: '備考', type: 'textarea' }
		];
		return json({ title: '担当者編集', fields });
	}

	// ── 活動履歴 ─────────────────────────────────────────────────
	if (tool === 'create_activity') {
		const fields: FormField[] = [
			{ key: 'customer_id', label: '顧客', type: 'recordSelect', required: true, refTable: 'customers' },
			{ key: 'type', label: '種別', type: 'select', value: 'note', options: ACTIVITY_TYPE_OPTIONS },
			{ key: 'content', label: '内容', type: 'textarea', required: true }
		];
		return json({ title: '活動履歴登録', fields });
	}

	return json({ error: 'Not found' }, { status: 404 });
};
