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
			'登録済みの外部API連携の一覧を取得する。どの外部APIが使えるか確認するために使う。',
		input_schema: { type: 'object', properties: {}, required: [] }
	},
	{
		name: 'call_external_api',
		description:
			'設定済みの外部APIを呼び出す。Slackへの通知送信・外部サービスのデータ取得など。まず list_integrations で使える連携を確認してから使う。',
		input_schema: {
			type: 'object',
			properties: {
				integration_id: { type: 'string', description: '連携のID（list_integrations で確認）' },
				endpoint: {
					type: 'string',
					description:
						'エンドポイントのパス（例: /chat.postMessage）またはフルURL。Webhook のようにベースURLだけで完結する場合は省略するか "/" を指定する'
				},
				method: {
					type: 'string',
					enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
					description: 'HTTPメソッド'
				},
				body: { type: 'object', description: 'リクエストボディ（JSON）' },
				query: { type: 'object', description: 'クエリパラメータ' },
				headers: { type: 'object', description: '追加リクエストヘッダー' }
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
	if (!integration) throw new Error(`連携が見つかりません: ${p.integration_id}`);

	const authConfig = parseJson(integration.authConfig);

	const base = integration.baseUrl.replace(/\/$/, '');
	let path: string;
	if (!p.endpoint || p.endpoint === '/') {
		path = base;
	} else if (p.endpoint.startsWith('http')) {
		if (new URL(p.endpoint).origin !== new URL(base).origin) {
			throw new Error('endpoint は連携先（baseUrl）と同じホストのURLのみ指定できます');
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
