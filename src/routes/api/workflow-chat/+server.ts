import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { env } from '$env/dynamic/private';
import { createDb } from '$lib/server/db';
import { dispatchTool, type ToolEnv } from '$lib/server/tools';
import { TextStreamProcessor, type StreamEvent } from '$lib/server/ai/stream';
import { buildWorkflowChatSystemPrompt } from '$lib/server/ai/prompt';
import { readonlyTools } from '$lib/server/ai/readonly-tools';
import type { WorkflowStep } from '$lib/types/chat';

function sse(event: StreamEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const mockMode = platform?.env?.MOCK_AI === 'true' || env.MOCK_AI === 'true';

	const body = (await request.json()) as {
		message: string;
		current: {
			name: string;
			triggerType?: 'schedule' | 'event' | 'mcp_tool';
			triggerHour: number;
			triggerMinute: number;
			triggerEvent?: 'create' | 'update' | 'delete' | null;
			triggerEntityTypeId?: string | null;
			inputSchema?: { key: string; label: string; type: string; required?: boolean }[];
			steps: WorkflowStep[];
		};
		history: { role: 'user' | 'assistant'; text: string }[];
	};

	if (mockMode) {
		const stream = new ReadableStream({
			async start(controller) {
				const enqueue = (e: StreamEvent) => controller.enqueue(new TextEncoder().encode(sse(e)));
				await new Promise((r) => setTimeout(r, 300));
				for (const char of 'どのような自動化フローにしますか？') {
					enqueue({ type: 'delta', text: char });
					await new Promise((r) => setTimeout(r, 20));
				}
				enqueue({ type: 'done' });
				controller.close();
			}
		});
		return new Response(stream, {
			headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
		});
	}

	if (!platform?.env?.DB) {
		return json({ error: 'DB not available' }, { status: 500 });
	}

	const apiKey = platform.env.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

	const db = createDb(platform.env.DB);
	const toolEnv: ToolEnv = {
		...platform.env,
		accountId: locals.account?.id,
		accountName: locals.account?.name
	};

	const systemPrompt = buildWorkflowChatSystemPrompt(body.current);

	const messages: MessageParam[] = [
		...body.history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text })),
		{ role: 'user', content: body.message }
	];

	const anthropic = new Anthropic({ apiKey });

	const stream = new ReadableStream({
		async start(controller) {
			const enqueue = (e: StreamEvent) => controller.enqueue(new TextEncoder().encode(sse(e)));
			try {
				let currentMessages = messages;

				for (let turn = 0; turn < 5; turn++) {
					const processor = new TextStreamProcessor();
					const toolBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
					let currentTool: { id: string; name: string; inputJson: string } | null = null;

					const claudeStream = anthropic.messages.stream({
						model: 'claude-haiku-4-5-20251001',
						max_tokens: 2048,
						system: systemPrompt,
						tools: readonlyTools,
						messages: currentMessages
					});

					for await (const event of claudeStream) {
						if (event.type === 'content_block_start') {
							if (event.content_block.type === 'tool_use') {
								currentTool = { id: event.content_block.id, name: event.content_block.name, inputJson: '' };
							}
						} else if (event.type === 'content_block_delta') {
							if (event.delta.type === 'text_delta') {
								for (const e of processor.process(event.delta.text)) enqueue(e);
							} else if (event.delta.type === 'input_json_delta' && currentTool) {
								currentTool.inputJson += event.delta.partial_json;
							}
						} else if (event.type === 'content_block_stop' && currentTool) {
							toolBlocks.push(currentTool);
							currentTool = null;
						}
					}
					for (const e of processor.flush()) enqueue(e);

					const finalMsg = await claudeStream.finalMessage();
					if (finalMsg.stop_reason !== 'tool_use') break;

					const toolResults = await Promise.all(
						toolBlocks.map(async (b) => {
							try {
								const input = JSON.parse(b.inputJson || '{}');
								const result = await dispatchTool(db, b.name as never, input, toolEnv);
								return {
									type: 'tool_result' as const,
									tool_use_id: b.id,
									content: JSON.stringify(result)
								};
							} catch (e) {
								return {
									type: 'tool_result' as const,
									tool_use_id: b.id,
									content: `エラー: ${e instanceof Error ? e.message : String(e)}`,
									is_error: true
								};
							}
						})
					);

					currentMessages = [
						...currentMessages,
						{ role: 'assistant' as const, content: finalMsg.content },
						{ role: 'user' as const, content: toolResults }
					];
				}

				enqueue({ type: 'done' });
			} catch (e) {
				enqueue({ type: 'error', message: String(e) });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
	});
};
