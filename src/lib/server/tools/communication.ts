import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { sendEmail, getEmailSetup } from '../email';
import { deleteReadNotifications, createNotification } from '../db/notification-service';
import { getSlackIntegration, sendSlackMessage } from '../slack';
import type { ToolEnv } from './shared';

export const tools: Tool[] = [
	{
		name: 'delete_read_notifications',
		description:
			'既読済みの通知をまとめて削除する。未読の通知は削除されない。自分の通知のみ対象。',
		input_schema: { type: 'object', properties: {}, required: [] }
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
	}
];

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

export async function handleDeleteReadNotifications(db: Db, _input: unknown, env?: ToolEnv) {
	if (!env?.accountId) throw new Error('ログインユーザーが特定できません。');
	const count = await deleteReadNotifications(db, env.accountId);
	return { deleted: count };
}
