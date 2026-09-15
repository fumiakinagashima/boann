import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import { integrations } from '../db/schema';
import { parseJson } from './shared';

export const tools: Tool[] = [
	{
		name: 'list_integrations',
		description:
			'Get the list of registered external API integrations. Use this to check which external APIs are available.',
		input_schema: { type: 'object', properties: {}, required: [] }
	},
	{
		name: 'call_external_api',
		description:
			'Call a configured external API. Used for things like sending a Slack notification or fetching data from an external service. Check the available integrations with list_integrations first before using this.',
		input_schema: {
			type: 'object',
			properties: {
				integration_id: { type: 'string', description: 'ID of the integration (check with list_integrations)' },
				endpoint: {
					type: 'string',
					description:
						'Endpoint path (e.g. /chat.postMessage) or a full URL. If the base URL alone is enough (as with a webhook), omit this or specify "/"'
				},
				method: {
					type: 'string',
					enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
					description: 'HTTP method'
				},
				body: { type: 'object', description: 'Request body (JSON)' },
				query: { type: 'object', description: 'Query parameters' },
				headers: { type: 'object', description: 'Additional request headers' }
			},
			required: ['integration_id', 'endpoint', 'method']
		}
	}
];

export async function handleListIntegrations(db: Db) {
	const rows = await db
		.select({
			id: integrations.id,
			name: integrations.name,
			description: integrations.description,
			baseUrl: integrations.baseUrl,
			authType: integrations.authType,
			createdAt: integrations.createdAt
		})
		.from(integrations)
		.orderBy(integrations.name);
	return rows;
}

const callExternalApiSchema = z.object({
	integration_id: z.string(),
	endpoint: z.string(),
	method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
	body: z.record(z.string(), z.unknown()).optional(),
	query: z.record(z.string(), z.unknown()).optional(),
	headers: z.record(z.string(), z.string()).optional()
});

export async function handleCallExternalApi(db: Db, input: unknown) {
	const p = callExternalApiSchema.parse(input);

	const [integration] = await db
		.select()
		.from(integrations)
		.where(eq(integrations.id, p.integration_id));
	if (!integration) throw new Error(`Integration not found: ${p.integration_id}`);

	const authConfig = parseJson(integration.authConfig);

	const base = integration.baseUrl.replace(/\/$/, '');
	let path: string;
	if (!p.endpoint || p.endpoint === '/') {
		path = base;
	} else if (p.endpoint.startsWith('http')) {
		if (new URL(p.endpoint).origin !== new URL(base).origin) {
			throw new Error('endpoint may only be a URL on the same host as the integration target (baseUrl)');
		}
		path = p.endpoint;
	} else {
		path = `${base}/${p.endpoint.replace(/^\//, '')}`;
	}

	let url = path;
	if (p.query && Object.keys(p.query).length > 0) {
		const params = new URLSearchParams();
		for (const [k, v] of Object.entries(p.query)) params.set(k, String(v));
		url += (url.includes('?') ? '&' : '?') + params.toString();
	}

	const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json', ...p.headers };

	switch (integration.authType) {
		case 'api_key':
			reqHeaders[(authConfig.headerName as string) || 'X-API-Key'] = authConfig.value as string;
			break;
		case 'bearer':
			reqHeaders['Authorization'] = `Bearer ${authConfig.value}`;
			break;
		case 'basic': {
			const encoded = btoa(`${authConfig.username}:${authConfig.password}`);
			reqHeaders['Authorization'] = `Basic ${encoded}`;
			break;
		}
	}

	const res = await fetch(url, {
		method: p.method,
		headers: reqHeaders,
		body: p.body !== undefined ? JSON.stringify(p.body) : undefined
	});

	const ct = res.headers.get('content-type') ?? '';
	const resBody = ct.includes('application/json') ? await res.json() : await res.text();

	return { status: res.status, ok: res.ok, body: resBody };
}
