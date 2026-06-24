import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getNotification, markNotificationRead } from '$lib/server/db/notification-service';
import { getChat, listChatMessages } from '$lib/server/db/chat-service';
import { listEntityTypesForWorkflow, type EntityTypeForWorkflow } from '$lib/server/db/table-service';
import { listSlackIntegrationsForWorkflow, type SlackIntegrationOption } from '$lib/server/slack';

export const load: PageServerLoad = async ({ url, platform, locals }) => {
	const notificationId = url.searchParams.get('notification');
	const chatId = url.searchParams.get('id');

	if (!platform?.env?.DB)
		return {
			seedNotification: null,
			seedChat: null,
			entityTypes: [] as EntityTypeForWorkflow[],
			slackIntegrations: [] as SlackIntegrationOption[]
		};

	const db = createDb(platform.env.DB);
	const [entityTypes, slackIntegrations] = await Promise.all([
		listEntityTypesForWorkflow(db),
		listSlackIntegrationsForWorkflow(db)
	]);

	if (notificationId) {
		const notification = await getNotification(db, notificationId);
		if (!notification) return { seedNotification: null, seedChat: null, entityTypes, slackIntegrations };
		if (notification.accountId && notification.accountId !== locals.account!.id) {
			return { seedNotification: null, seedChat: null, entityTypes, slackIntegrations };
		}

		if (!notification.isRead) await markNotificationRead(db, notificationId);

		return {
			seedNotification: { id: notification.id, seedContent: notification.seedContent },
			seedChat: null,
			entityTypes,
			slackIntegrations
		};
	}

	if (chatId) {
		const chat = await getChat(db, chatId);
		if (!chat) return { seedNotification: null, seedChat: null, entityTypes, slackIntegrations };
		if (chat.accountId && chat.accountId !== locals.account!.id) {
			return { seedNotification: null, seedChat: null, entityTypes, slackIntegrations };
		}

		const messages = await listChatMessages(db, chatId);
		return { seedNotification: null, seedChat: { id: chat.id, messages }, entityTypes, slackIntegrations };
	}

	return { seedNotification: null, seedChat: null, entityTypes, slackIntegrations };
};
