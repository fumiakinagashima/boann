import { and, eq, lte } from 'drizzle-orm';
import { reminders, type Reminder } from '../db/schema';
import { parseChannels } from '../db/reminder-service';
import { createNotification } from '../db/notification-service';
import { getAccount } from '../db/account-service';
import { getSlackIntegration, sendSlackMessage } from '../slack';
import { getEmailSetupFromEnv, sendEmail, type EmailEnv } from '../email';
import type { Db } from '../db';

// リマインダーに accountId が設定されていない場合（ログイン実装前の既存データ）のフォールバック先
const REMINDER_EMAIL_TO = 'alcogyinc@gmail.com';

export type ReminderDeliveryResult = {
	id: string;
	status: 'sent' | 'failed';
	errors: string[];
};

export async function getDueReminders(db: Db, now: Date = new Date()): Promise<Reminder[]> {
	return db
		.select()
		.from(reminders)
		.where(and(eq(reminders.status, 'pending'), lte(reminders.remindAt, now)));
}

async function deliverToChannel(db: Db, channel: string, reminder: Reminder, env?: EmailEnv): Promise<void> {
	if (channel === 'notification') {
		// accountId が未設定のレガシーデータはスキップ（通知の送り先が特定できないため）
		if (!reminder.accountId) return;
		await createNotification(db, {
			type: 'reminder',
			title: 'リマインダー',
			body: reminder.content,
			seedContent: [{ type: 'text', text: `リマインダー: ${reminder.content}` }],
			accountId: reminder.accountId
		});
		return;
	}

	if (channel === 'email') {
		// 通知メールは「送信元メール設定」（/settings/email、send_email用）とは別に、
		// システムメールとして環境変数（EMAIL_PROVIDER 等）の設定を使う
		const setup = getEmailSetupFromEnv(env ?? {});
		if (!setup) throw new Error('システムメールが設定されていません（EMAIL_PROVIDER 等の環境変数を確認してください）');
		const account = reminder.accountId ? await getAccount(db, reminder.accountId) : null;
		const to = account?.email ?? REMINDER_EMAIL_TO;
		await sendEmail(setup.providerConfig, {
			from: setup.from,
			fromName: setup.fromName,
			to,
			subject: 'リマインダー',
			text: reminder.content
		});
		return;
	}

	if (channel.startsWith('slack:')) {
		const integration = await getSlackIntegration(db, channel.slice('slack:'.length));
		if (!integration) throw new Error(`Slack連携が見つかりません: ${channel}`);
		await sendSlackMessage(integration, reminder.content);
		return;
	}

	throw new Error(`未対応の通知先です: ${channel}`);
}

export async function deliverReminder(db: Db, reminder: Reminder, env?: EmailEnv): Promise<ReminderDeliveryResult> {
	const channels = parseChannels(reminder.channels);
	const deliveryErrors: string[] = [];
	for (const channel of channels) {
		try {
			await deliverToChannel(db, channel, reminder, env);
		} catch (e) {
			deliveryErrors.push(`${channel}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	const status = deliveryErrors.length === 0 ? 'sent' : 'failed';
	await db.update(reminders).set({ status }).where(eq(reminders.id, reminder.id));
	return { id: reminder.id, status, errors: deliveryErrors };
}

export async function processDueReminders(
	db: Db,
	env?: EmailEnv,
	now: Date = new Date()
): Promise<ReminderDeliveryResult[]> {
	const due = await getDueReminders(db, now);
	const results: ReminderDeliveryResult[] = [];
	for (const reminder of due) {
		results.push(await deliverReminder(db, reminder, env));
	}
	return results;
}
