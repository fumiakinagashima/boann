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
			'Bulk-delete already-read notifications. Unread notifications are not deleted. Only affects the caller\'s own notifications.',
		input_schema: { type: 'object', properties: {}, required: [] }
	},
	{
		name: 'send_email',
		description: 'Send an email to the specified recipient.',
		input_schema: {
			type: 'object',
			properties: {
				to: { type: 'string', description: 'Recipient email address' },
				subject: { type: 'string', description: 'Subject' },
				body: { type: 'string', description: 'Body (plain text)' }
			},
			required: ['to', 'subject', 'body']
		}
	},
	{
		name: 'send_notification',
		description: 'Send a notification to the notification center addressed to yourself. Use this when you want to notify the user in-app rather than by email.',
		input_schema: {
			type: 'object',
			properties: {
				title: { type: 'string', description: 'Notification title' },
				body: { type: 'string', description: 'Notification body' }
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
			'Email sending is not configured (set it up at /settings/email, or set environment variables such as EMAIL_PROVIDER / EMAIL_FROM)'
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
	if (!env?.accountId) throw new Error('Could not identify the recipient account.');
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

/** Workflow-only (not exposed to the AI chat). When the AI needs to send to Slack, it uses list_integrations + call_external_api instead. */
export async function handleSendSlackNotification(db: Db, input: unknown, _env?: ToolEnv) {
	const data = sendSlackNotificationSchema.parse(input);
	const integration = await getSlackIntegration(db, data.integration_id);
	if (!integration) throw new Error(`Slack integration not found (id: ${data.integration_id})`);
	await sendSlackMessage(integration, data.body);
	return { integrationName: integration.name };
}

export async function handleDeleteReadNotifications(db: Db, _input: unknown, env?: ToolEnv) {
	if (!env?.accountId) throw new Error('Could not identify the logged-in user.');
	const count = await deleteReadNotifications(db, env.accountId);
	return { deleted: count };
}
