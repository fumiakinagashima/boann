import Anthropic from '@anthropic-ai/sdk';
import { CHAT_TITLE_SYSTEM_PROMPT } from './prompt';

export async function generateChatTitle(apiKey: string, message: string, model = 'claude-haiku-4-5-20251001'): Promise<string> {
	const anthropic = new Anthropic({ apiKey, timeout: 15000 });
	const response = await anthropic.messages.create({
		model,
		max_tokens: 64,
		system: CHAT_TITLE_SYSTEM_PROMPT,
		messages: [{ role: 'user', content: message }]
	});
	const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
	if (!text) throw new Error('タイトルの生成に失敗しました。');
	return text;
}
