import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { env } from '$env/dynamic/private';
import { streamChat, type StreamEvent } from '$lib/server/ai/stream';
import { getAiModel } from '$lib/server/ai/settings';
import { mockChat } from '$lib/server/ai/mock';
import { createDb } from '$lib/server/db';
import { dispatchTool, type ToolEnv } from '$lib/server/tools';
import { checkRateLimit } from '$lib/server/rate-limit';
import { errors } from '$lib/server/errors';
import type { Message, MessageContent } from '$lib/types/chat';

function sse(event: StreamEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const mockMode = platform?.env?.MOCK_AI === 'true' || env.MOCK_AI === 'true';

	if (!platform?.env?.DB) {
		return json({ error: 'D1 database is not configured. Please start with wrangler dev.' }, { status: 500 });
	}

	const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For') ?? '';
	const isLocal = !ip || ip === '127.0.0.1' || ip === '::1';
	if (!isLocal) {
		const rl = await checkRateLimit(platform.env.KV, 'chat', ip);
		if (!rl.allowed) return errors.tooManyRequests(rl.retryAfter ?? 60);
	}

	if (!mockMode) {
		const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
		if (!apiKey) {
			return json({ error: 'ANTHROPIC_API_KEY is not set.' }, { status: 500 });
		}
	}

	const body = await request.json() as {
		message?: string;
		tool?: string;
		data?: Record<string, string>;
		history?: Message[];
		context?: {
			appId: string;
			appLabel: string;
			appName: string;
			tables: Array<{ id: string; name: string; label: string }>;
		};
	};
	const db = createDb(platform.env.DB);
	const toolEnv: ToolEnv = {
		...platform.env,
		accountId: locals.account?.id,
		accountName: locals.account?.name,
		appId: body.context?.appId
	};

	// Form submissions (tool + data) are returned as JSON
	if (body.tool && body.data) {
		try {
			const result = await dispatchTool(db, body.tool as never, body.data, toolEnv, platform.ctx);

			if (body.tool === 'send_email') {
				const sent = result as { to: string; subject: string };
				const contents: MessageContent[] = [
					{ type: 'text', text: `Email sent to ${sent.to}.` },
					{
						type: 'values',
						title: 'Sent content',
						items: [
							{ label: 'To', value: sent.to, format: 'text' },
							{ label: 'Subject', value: sent.subject, format: 'text' }
						]
					}
				];
				return json({ contents });
			}

			const contents: MessageContent[] = [
				{ type: 'text', text: `Registration complete.` },
				{
					type: 'table',
					columns: Object.keys(result as object).map((key) => ({ key, label: key })),
					rows: [result as Record<string, unknown>]
				}
			];
			return json({ contents });
		} catch (e) {
			return json({
				contents: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }]
			});
		}
	}

	// Chat messages are returned as an SSE stream
	const userMessage = body.message?.trim() ?? '';
	if (!userMessage) {
		return json({ error: 'Message is empty.' }, { status: 400 });
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
			// Keep assistant responses that are UI-only (no text) in the history too.
			// Dropping them makes the prior user request look unanswered, causing the AI to
			// re-display past content (accumulating) in its next response.
			if (m.role === 'assistant' && m.contents.length > 0) {
				return [{ role: 'assistant', content: '(Displayed the requested content in the UI)' }];
			}
			return [];
		});
	history.push({ role: 'user', content: userMessage });

	// Mock mode: simulate the stream character by character
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
