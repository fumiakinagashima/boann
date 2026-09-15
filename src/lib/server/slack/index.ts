import { like } from 'drizzle-orm';
import { integrations } from '../db/schema';
import type { Db } from '../db';

export type SlackIntegration = { id: string; name: string; baseUrl: string };

// Treat integrations whose base_url is a Slack Incoming Webhook (hooks.slack.com) as Slack notification targets
export async function listSlackIntegrations(db: Db): Promise<SlackIntegration[]> {
	return db
		.select({ id: integrations.id, name: integrations.name, baseUrl: integrations.baseUrl })
		.from(integrations)
		.where(like(integrations.baseUrl, '%hooks.slack.com%'));
}

export async function getSlackIntegration(db: Db, id: string): Promise<SlackIntegration | null> {
	const rows = await listSlackIntegrations(db);
	return rows.find((r) => r.id === id) ?? null;
}

export type SlackIntegrationOption = { id: string; name: string };

/** Gets a list without the webhook URL (baseUrl) included, for the workflow's "Slack" target selector. */
export async function listSlackIntegrationsForWorkflow(db: Db): Promise<SlackIntegrationOption[]> {
	return (await listSlackIntegrations(db)).map((s) => ({ id: s.id, name: s.name }));
}

/**
 * In Slack's mrkdwn, `&`, `<`, and `>` are interpreted as special characters (link/mention syntax),
 * so escape them before sending (reference: https://api.slack.com/reference/surfaces/formatting#escaping).
 * Since there is a path where user-input-derived strings — such as a workflow's @item:<field> — are
 * sent as-is, this prevents embedding a spoofed link (e.g. `<https://evil.example|text that looks legitimate>`).
 */
function escapeSlackMrkdwn(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function sendSlackMessage(integration: SlackIntegration, text: string): Promise<void> {
	const res = await fetch(integration.baseUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ text: escapeSlackMrkdwn(text) })
	});
	if (!res.ok) {
		throw new Error(`Failed to send Slack notification (${integration.name}): ${res.status}`);
	}
}
