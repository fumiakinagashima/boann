import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { env } from '$env/dynamic/private';
import { streamChat, type StreamEvent } from '$lib/server/ai/stream';
import { getAiModel } from '$lib/server/ai/settings';
import { mockChat } from '$lib/server/ai/mock';
import { createDb } from '$lib/server/db';
import { dispatchTool, type ToolEnv } from '$lib/server/mcp';
import { checkRateLimit } from '$lib/server/rate-limit';
import { errors } from '$lib/server/errors';
import type { Message, MessageContent, ValueItem } from '$lib/types/chat';

function sse(event: StreamEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

const CUSTOMER_VALUE_FIELDS = [
	{ key: 'name', label: '会社名' },
	{ key: 'email', label: 'メールアドレス' },
	{ key: 'phone', label: '電話番号' },
	{ key: 'address', label: '住所' },
	{ key: 'website', label: 'ホームページ' },
	{ key: 'notes', label: '備考' }
];

const CONTACT_VALUE_FIELDS = [
	{ key: 'name', label: '氏名' },
	{ key: 'nameKana', label: '氏名（カナ）' },
	{ key: 'role', label: '役職' },
	{ key: 'department', label: '部署' }
];

function valueItems(obj: Record<string, unknown>, fields: { key: string; label: string }[]): ValueItem[] {
	return fields
		.filter((f) => obj[f.key] != null && obj[f.key] !== '')
		.map((f) => ({ label: f.label, value: obj[f.key] as string, format: 'text' as const }));
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const mockMode = platform?.env?.MOCK_AI === 'true' || env.MOCK_AI === 'true';

	if (!platform?.env?.DB) {
		return json({ error: 'D1データベースが設定されていません。wrangler dev で起動してください。' }, { status: 500 });
	}

	const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? 'unknown';
	const rl = await checkRateLimit(platform.env.KV, 'chat', ip);
	if (!rl.allowed) return errors.tooManyRequests(rl.retryAfter ?? 60);

	if (!mockMode) {
		const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
		if (!apiKey) {
			return json({ error: 'ANTHROPIC_API_KEY が設定されていません。' }, { status: 500 });
		}
	}

	const db = createDb(platform.env.DB);
	const toolEnv: ToolEnv = {
		...platform.env,
		accountId: locals.account?.id,
		accountName: locals.account?.name
	};
	const body = await request.json() as {
		message?: string;
		tool?: string;
		data?: Record<string, string>;
		history?: Message[];
		context?: {
			appId: string;
			appLabel: string;
			appName: string;
			spec?: string | null;
			tables: Array<{ id: string; name: string; label: string }>;
		};
	};

	// フォーム送信（tool + data）はJSONで返す
	if (body.tool && body.data) {
		try {
			const result = await dispatchTool(db, body.tool as never, body.data, toolEnv, platform.ctx);

			if (body.tool === 'create_customer_with_contact') {
				const { customer, contact } = result as {
					customer: Record<string, unknown>;
					contact: Record<string, unknown>;
				};
				const contents: MessageContent[] = [
					{ type: 'text', text: '顧客と担当者を登録しました。' },
					{ type: 'values', title: '顧客情報', items: valueItems(customer, CUSTOMER_VALUE_FIELDS) },
					{ type: 'values', title: '担当者情報', items: valueItems(contact, CONTACT_VALUE_FIELDS) }
				];
				return json({ contents });
			}

			if (body.tool === 'create_contact') {
				const contact = result as Record<string, unknown>;
				const contents: MessageContent[] = [
					{ type: 'text', text: '担当者を登録しました。' },
					{ type: 'values', title: '担当者情報', items: valueItems(contact, CONTACT_VALUE_FIELDS) }
				];
				return json({ contents });
			}

			if (body.tool === 'create_reminder') {
				const reminder = result as { remindAt: Date; content: string; channelLabels: string[] };
				const contents: MessageContent[] = [
					{ type: 'text', text: 'リマインダーを登録しました。' },
					{
						type: 'values',
						title: 'リマインダー',
						items: [
							{ label: '日時', value: reminder.remindAt.toISOString(), format: 'datetime' },
							{ label: '内容', value: reminder.content, format: 'text' },
							{ label: '通知先', value: reminder.channelLabels.join(' / '), format: 'text' }
						]
					}
				];
				return json({ contents });
			}

			if (body.tool === 'send_email') {
				const sent = result as { to: string; subject: string };
				const contents: MessageContent[] = [
					{ type: 'text', text: `${sent.to} 宛にメールを送信しました。` },
					{
						type: 'values',
						title: '送信内容',
						items: [
							{ label: '宛先', value: sent.to, format: 'text' },
							{ label: '件名', value: sent.subject, format: 'text' }
						]
					}
				];
				return json({ contents });
			}

			const contents: MessageContent[] = [
				{ type: 'text', text: `登録が完了しました。` },
				{
					type: 'table',
					columns: Object.keys(result as object).map((key) => ({ key, label: key })),
					rows: [result as Record<string, unknown>]
				}
			];
			return json({ contents });
		} catch (e) {
			return json({
				contents: [{ type: 'text', text: `エラー: ${e instanceof Error ? e.message : String(e)}` }]
			});
		}
	}

	// チャットメッセージはSSEストリームで返す
	const userMessage = body.message?.trim() ?? '';
	if (!userMessage) {
		return json({ error: 'メッセージが空です。' }, { status: 400 });
	}

	const history: MessageParam[] = (body.history ?? [])
		.filter((m) => m.role === 'user' || m.role === 'assistant')
		.flatMap((m): MessageParam[] => {
			const text = m.contents
				.filter((c) => c.type === 'text')
				.map((c) => (c.type === 'text' ? c.text : ''))
				.join('\n')
				.trim();
			if (text) return [{ role: m.role as 'user' | 'assistant', content: text }];
			// UIのみ（テキストなし）のアシスタント応答も履歴に残す。
			// 落とすと直前のユーザー要求が未応答に見え、AIが次の応答で過去分まで再表示（累積）してしまう。
			if (m.role === 'assistant' && m.contents.length > 0) {
				return [{ role: 'assistant', content: '（依頼された内容をUIで表示しました）' }];
			}
			return [];
		});
	history.push({ role: 'user', content: userMessage });

	// モックモード: 文字単位でストリームをシミュレート
	if (mockMode) {
		const stream = new ReadableStream({
			async start(controller) {
				const enqueue = (e: StreamEvent) => controller.enqueue(new TextEncoder().encode(sse(e)));
				await new Promise((r) => setTimeout(r, 400));
				const contents = mockChat();
				for (const content of contents) {
					if (content.type === 'text') {
						for (const char of content.text) {
							enqueue({ type: 'delta', text: char });
							await new Promise((r) => setTimeout(r, 18));
						}
					} else {
						enqueue({ type: 'ui', content });
						await new Promise((r) => setTimeout(r, 80));
					}
				}
				enqueue({ type: 'done' });
				controller.close();
			}
		});
		return new Response(stream, {
			headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
		});
	}

	const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	const model = await getAiModel(db);

	const stream = new ReadableStream({
		async start(controller) {
			const enqueue = (e: StreamEvent) => controller.enqueue(new TextEncoder().encode(sse(e)));
			try {
				await streamChat(db, apiKey, history, model, enqueue, toolEnv, platform.ctx, body.context);
				enqueue({ type: 'done' });
			} catch (e) {
				enqueue({ type: 'error', message: e instanceof Error ? e.message : String(e) });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
	});
};
