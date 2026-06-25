import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { sendEmail, getEmailSetup } from '../email';
import { createReminder, listReminders, resolveChannelLabels, deleteSentReminders } from '../db/reminder-service';
import { deleteReadNotifications, createNotification } from '../db/notification-service';
import { getSlackIntegration, sendSlackMessage } from '../slack';
import { parseJstDatetime } from '$lib/datetime';
import type { ToolEnv } from './shared';

export const tools: Tool[] = [
	{
		name: 'delete_sent_reminders',
		description:
			'送信済み（status=sent）のリマインダーをまとめて削除する。未送信（pending）のリマインダーは削除されない。自分のリマインダーのみ対象。',
		input_schema: { type: 'object', properties: {}, required: [] }
	},
	{
		name: 'delete_read_notifications',
		description:
			'既読済みの通知をまとめて削除する。未読の通知は削除されない。自分の通知のみ対象。',
		input_schema: { type: 'object', properties: {}, required: [] }
	},
	{
		name: 'list_reminders',
		description:
			'登録済みリマインダーの一覧を取得する。「リマインダーを見せて」「登録したリマインダーは？」などに使う。',
		input_schema: {
			type: 'object',
			properties: {
				status: {
					type: 'string',
					enum: ['pending', 'sent', 'failed'],
					description: 'ステータスで絞り込む（省略時は全件）'
				}
			},
			required: []
		}
	},
	{
		name: 'send_email',
		description: '指定した宛先にメールを送信する。',
		input_schema: {
			type: 'object',
			properties: {
				to: { type: 'string', description: '送信先メールアドレス' },
				subject: { type: 'string', description: '件名' },
				body: { type: 'string', description: '本文（プレーンテキスト）' }
			},
			required: ['to', 'subject', 'body']
		}
	},
	{
		name: 'send_notification',
		description: '自分宛てに通知センターへ通知を送る。メールではなくアプリ内の通知として知らせたい場合に使う。',
		input_schema: {
			type: 'object',
			properties: {
				title: { type: 'string', description: '通知のタイトル' },
				body: { type: 'string', description: '通知の本文' }
			},
			required: ['title', 'body']
		}
	},
	{
		name: 'create_reminder',
		description:
			'指定した日時にリマインダーを登録する（登録のみ。実際の通知送信は別途行われる）。',
		input_schema: {
			type: 'object',
			properties: {
				remind_at: { type: 'string', description: '通知日時（YYYY-MM-DDTHH:mm形式）' },
				content: { type: 'string', description: 'リマインダーの内容' },
				channels: {
					type: 'string',
					description: '通知先（カンマ区切り）。notification / email / slack:<integration_id>'
				}
			},
			required: ['remind_at', 'content', 'channels']
		}
	},
	{
		name: 'create_reminders_bulk',
		description:
			'複数のリマインダーを一括登録する。フォローアップ提案などの一覧からまとめて登録する場合に使う。' +
			'remind_at・channels は全件共通。内容（content）のみ件ごとに指定する。',
		input_schema: {
			type: 'object',
			properties: {
				remind_at: { type: 'string', description: '共通の通知日時（YYYY-MM-DDTHH:mm形式）' },
				channels: {
					type: 'string',
					description: '共通の通知先（カンマ区切り）。notification / email / slack:<integration_id>'
				},
				reminders: {
					type: 'array',
					description: '登録するリマインダーのリスト',
					items: {
						type: 'object',
						properties: {
							content: { type: 'string', description: 'リマインダーの内容' }
						},
						required: ['content']
					}
				}
			},
			required: ['remind_at', 'channels', 'reminders']
		}
	}
];

const listRemindersSchema = z.object({
	status: z.enum(['pending', 'sent', 'failed']).optional()
});

export async function handleListReminders(db: Db, input: unknown, env?: ToolEnv) {
	const { status } = listRemindersSchema.parse(input);
	const rows = await listReminders(db, env?.accountId);
	const filtered = status ? rows.filter((r) => r.status === status) : rows;
	return filtered.map((r) => ({
		id: r.id,
		content: r.content,
		remindAt: r.remindAt.toISOString(),
		channels: r.channelLabels.join('、'),
		status: r.status
	}));
}

const sendEmailSchema = z.object({
	to: z.string().email(),
	subject: z.string().min(1),
	body: z.string().min(1)
});

export async function handleSendEmail(db: Db, input: unknown, env?: ToolEnv) {
	const data = sendEmailSchema.parse(input);
	const setup = await getEmailSetup(db, env);
	if (!setup) {
		throw new Error(
			'メール送信が設定されていません（/settings/email、または EMAIL_PROVIDER / EMAIL_FROM などの環境変数を設定してください）'
		);
	}
	const body = setup.signature ? `${data.body}\n\n${setup.signature}` : data.body;
	await sendEmail(setup.providerConfig, {
		from: setup.from,
		fromName: setup.fromName,
		to: data.to,
		subject: data.subject,
		text: body
	});

	return { to: data.to, subject: data.subject };
}

const sendNotificationSchema = z.object({
	title: z.string().min(1),
	body: z.string().min(1)
});

export async function handleSendNotification(db: Db, input: unknown, env?: ToolEnv) {
	const data = sendNotificationSchema.parse(input);
	if (!env?.accountId) throw new Error('通知先のアカウントが特定できません。');
	const notification = await createNotification(db, {
		type: 'workflow',
		title: data.title,
		body: data.body,
		seedContent: [{ type: 'text', text: data.body }],
		accountId: env.accountId
	});
	return { id: notification.id, title: notification.title };
}

const sendSlackNotificationSchema = z.object({
	integration_id: z.string().min(1),
	body: z.string().min(1)
});

/** ワークフロー専用（AIチャットには公開しない）。AIがSlackに送る場合はlist_integrations + call_external_apiを使う。 */
export async function handleSendSlackNotification(db: Db, input: unknown, _env?: ToolEnv) {
	const data = sendSlackNotificationSchema.parse(input);
	const integration = await getSlackIntegration(db, data.integration_id);
	if (!integration) throw new Error(`Slack連携が見つかりません（id: ${data.integration_id}）`);
	await sendSlackMessage(integration, data.body);
	return { integrationName: integration.name };
}

const createReminderSchema = z.object({
	remind_at: z.string().min(1),
	content: z.string().min(1),
	channels: z.string().min(1)
});

export async function handleCreateReminder(db: Db, input: unknown, env?: ToolEnv) {
	const data = createReminderSchema.parse(input);
	const channels = data.channels
		.split(',')
		.map((c) => c.trim())
		.filter(Boolean);
	const reminder = await createReminder(db, {
		remindAt: parseJstDatetime(data.remind_at),
		content: data.content,
		channels,
		accountId: env?.accountId ?? null
	});

	const channelLabels = await resolveChannelLabels(db, channels);

	return { ...reminder, channelLabels };
}

const createRemindersBulkSchema = z.object({
	remind_at: z.string().min(1),
	channels: z.string().min(1),
	reminders: z.array(z.object({ content: z.string().min(1) })).min(1)
});

export async function handleCreateRemindersBulk(db: Db, input: unknown, env?: ToolEnv) {
	const data = createRemindersBulkSchema.parse(input);
	const channels = data.channels.split(',').map((c) => c.trim()).filter(Boolean);
	const remindAt = parseJstDatetime(data.remind_at);
	const accountId = env?.accountId ?? null;

	const created = [];
	for (const item of data.reminders) {
		const reminder = await createReminder(db, { remindAt, content: item.content, channels, accountId });
		created.push(reminder);
	}

	const channelLabels = await resolveChannelLabels(db, channels);

	return {
		count: created.length,
		remind_at: data.remind_at,
		channelLabels,
		reminders: created.map((r) => ({ id: r.id, content: r.content }))
	};
}

export async function handleDeleteSentReminders(db: Db, _input: unknown, env?: ToolEnv) {
	if (!env?.accountId) throw new Error('ログインユーザーが特定できません。');
	const count = await deleteSentReminders(db, env.accountId);
	return { deleted: count };
}

export async function handleDeleteReadNotifications(db: Db, _input: unknown, env?: ToolEnv) {
	if (!env?.accountId) throw new Error('ログインユーザーが特定できません。');
	const count = await deleteReadNotifications(db, env.accountId);
	return { deleted: count };
}
