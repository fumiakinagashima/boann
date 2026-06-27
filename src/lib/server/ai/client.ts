import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { SYSTEM_PROMPT } from './prompt';
import { tools, dispatchTool } from '$lib/server/mcp';
import type { Db } from '$lib/server/db';
import type { MessageContent } from '$lib/types/chat';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export async function chat(
	db: Db,
	apiKey: string,
	history: MessageParam[],
	model?: string
): Promise<MessageContent[]> {
	const anthropic = new Anthropic({ apiKey });

	let messages: MessageParam[] = [...history];
	const contents: MessageContent[] = [];

	// ツールコールのループ（最大5回）
	for (let i = 0; i < 5; i++) {
		const response = await anthropic.messages.create({
			model: model ?? DEFAULT_MODEL,
			max_tokens: 4096,
			system: SYSTEM_PROMPT,
			tools,
			messages
		});

		// テキストと<ui>タグをパース
		for (const block of response.content) {
			if (block.type === 'text') {
				const parsed = parseTextContent(block.text);
				contents.push(...parsed);
			}
		}

		// ツールコールがなければ終了
		if (response.stop_reason !== 'tool_use') break;

		// ツールを実行してループ継続
		const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
		const toolResults = await Promise.all(
			toolUseBlocks.map(async (block) => {
				if (block.type !== 'tool_use') return null;
				try {
					const result = await dispatchTool(db, block.name as never, block.input);
					return {
						type: 'tool_result' as const,
						tool_use_id: block.id,
						content: JSON.stringify(result)
					};
				} catch (e) {
					return {
						type: 'tool_result' as const,
						tool_use_id: block.id,
						content: `エラー: ${e instanceof Error ? e.message : String(e)}`,
						is_error: true
					};
				}
			})
		);

		messages = [
			...messages,
			{ role: 'assistant', content: response.content },
			{ role: 'user', content: toolResults.filter(Boolean) as never }
		];
	}

	return contents;
}

function parseTextContent(text: string): MessageContent[] {
	const contents: MessageContent[] = [];
	const uiRegex = /<ui\s([^>]*)>([\s\S]*?)<\/ui>/g;
	let lastIndex = 0;
	let match;

	while ((match = uiRegex.exec(text)) !== null) {
		// UIタグより前のテキスト
		if (match.index > lastIndex) {
			const before = text.slice(lastIndex, match.index).trim();
			if (before) contents.push({ type: 'text', text: before });
		}

		const attrs = match[1];
		const body = match[2].trim();
		const type = /type="([^"]+)"/.exec(attrs)?.[1];
		const title = /title="([^"]+)"/.exec(attrs)?.[1];
		const tool = /tool="([^"]+)"/.exec(attrs)?.[1];

		try {
			if (type === 'form' && tool) {
				const fields = JSON.parse(body);
				contents.push({ type: 'form', title, fields, tool });
			} else if (type === 'table') {
				const { columns, rows } = JSON.parse(body);
				contents.push({ type: 'table', columns, rows });
			} else if (type === 'values') {
				const items = JSON.parse(body);
				contents.push({ type: 'values', title, items });
			}
		} catch {
			contents.push({ type: 'text', text: body });
		}

		lastIndex = match.index + match[0].length;
	}

	// UIタグより後のテキスト
	if (lastIndex < text.length) {
		const after = text.slice(lastIndex).trim();
		if (after) contents.push({ type: 'text', text: after });
	}

	return contents.length > 0 ? contents : [{ type: 'text', text: text.trim() }];
}
