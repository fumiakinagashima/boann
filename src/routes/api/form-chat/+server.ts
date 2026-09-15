import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { env } from '$env/dynamic/private';
import { createDb } from '$lib/server/db';
import { dispatchTool, type ToolEnv } from '$lib/server/tools';
import type { StreamEvent } from '$lib/server/ai/stream';
import { readonlyTools } from '$lib/server/ai/readonly-tools';

function sse(event: StreamEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const mockMode = platform?.env?.MOCK_AI === 'true' || env.MOCK_AI === 'true';

	const body = (await request.json()) as {
		message: string;
		formTitle: string;
		formFields: { key: string; label: string }[];
		history: { role: 'user' | 'assistant'; text: string }[];
		// The record currently displayed in the dialog (when viewing details). Used to resolve
		// referring expressions like "this customer".
		recordContext?: {
			type: string;
			typeLabel: string;
			id: string;
			label: string;
			data?: Record<string, unknown>;
		} | null;
	};

	if (mockMode) {
		const stream = new ReadableStream({
			async start(controller) {
				const enqueue = (e: StreamEvent) => controller.enqueue(new TextEncoder().encode(sse(e)));
				await new Promise((r) => setTimeout(r, 300));
				for (const char of 'Thank you for your question.') {
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

	const sections: string[] = [
		'You are an AI assistant that helps the user with the content of the dialog currently open on the screen.'
	];

	const rc = body.recordContext;
	if (rc) {
		const dataLines = rc.data
			? Object.entries(rc.data)
					.filter(([, v]) => v != null && v !== '')
					.map(([k, v]) => `  - ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
					.join('\n')
			: '';
		sections.push(
			`Record currently displayed in the dialog:
- Type: ${rc.typeLabel} (${rc.type})
- ID: ${rc.id}
- Name: ${rc.label}${dataLines ? `\n- Displayed content:\n${dataLines}` : ''}

When the user refers to "this record" or "this" with a referring expression, it refers to the record shown above (no need to ask which record they mean).
If you need to retrieve related data, use the ID above to fetch it with a tool.`
		);
	}

	if (body.formFields.length > 0) {
		const fieldList = body.formFields.map((f) => `- ${f.label} (${f.key})`).join('\n');
		sections.push(
			`This dialog is the "${body.formTitle}" form. Provide concrete advice and information to help the user fill in each field correctly.
List of form fields:
${fieldList}`
		);
	}

	sections.push(
		`Available tools: you can search, retrieve, and aggregate data from custom tables.
Constraints: you cannot register, update, or delete data, or send email. You can only retrieve information.
Present dates, numbers, and similar values clearly, and keep your answers concise.`
	);

	const systemPrompt = sections.join('\n\n');

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
					const toolBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
					let currentTool: { id: string; name: string; inputJson: string } | null = null;
					let assistantText = '';

					const claudeStream = anthropic.messages.stream({
						model: 'claude-haiku-4-5-20251001',
						max_tokens: 1024,
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
								assistantText += event.delta.text;
								enqueue({ type: 'delta', text: event.delta.text });
							} else if (event.delta.type === 'input_json_delta' && currentTool) {
								currentTool.inputJson += event.delta.partial_json;
							}
						} else if (event.type === 'content_block_stop' && currentTool) {
							toolBlocks.push(currentTool);
							currentTool = null;
						}
					}

					const finalMsg = await claudeStream.finalMessage();
					if (finalMsg.stop_reason !== 'tool_use') break;

					// Text from the tool-call turn has already been streamed, so just continue
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
									content: `Error: ${e instanceof Error ? e.message : String(e)}`,
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
