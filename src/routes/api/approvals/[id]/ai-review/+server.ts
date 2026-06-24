import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { createDb } from '$lib/server/db';
import { getApproval } from '$lib/server/db/approval-service';
import { getR2 } from '$lib/server/r2-service';
import { APPROVAL_REVIEW_SYSTEM_PROMPT, buildApprovalReviewPrompt } from '$lib/server/ai/prompt';

export type ApprovalReviewResult = {
	riskLevel: 'low' | 'medium' | 'high';
	summary: string;
	concerns: string[];
	checks: string[];
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	const CHUNK = 8192;
	const parts: string[] = [];
	for (let i = 0; i < bytes.length; i += CHUNK) {
		parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
	}
	return btoa(parts.join(''));
}

export const POST: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY が設定されていません。' }, { status: 500 });

	const db = createDb(platform.env.DB);
	const row = await getApproval(db, params.id);
	if (!row) return json({ error: '申請が見つかりません' }, { status: 404 });

	// 画像添付があれば内容と一緒にAIへ渡す
	const content: Array<
		| { type: 'text'; text: string }
		| { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }
	> = [];

	if (platform.env.R2) {
		for (const att of row.attachments) {
			if (!att.key || att.size > MAX_IMAGE_BYTES || !IMAGE_TYPES.includes(att.mimeType)) continue;
			const obj = await getR2(platform.env.R2, att.key);
			if (!obj) continue;
			const buffer = await obj.arrayBuffer();
			content.push({
				type: 'image',
				source: { type: 'base64', media_type: att.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: arrayBufferToBase64(buffer) }
			});
		}
	}

	content.push({ type: 'text', text: buildApprovalReviewPrompt(row) });

	const anthropic = new Anthropic({ apiKey, timeout: 30000 });
	let text = '';
	try {
		const message = await anthropic.messages.create({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 1024,
			system: APPROVAL_REVIEW_SYSTEM_PROMPT,
			messages: [{ role: 'user', content }]
		});
		text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: `AIエラー: ${msg}` }, { status: 500 });
	}

	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		return json({ error: `レビュー結果の解析に失敗しました。(response: ${text.slice(0, 100)})` }, { status: 500 });
	}

	try {
		const result = JSON.parse(jsonMatch[0]) as ApprovalReviewResult;
		return json(result);
	} catch {
		return json({ error: 'レビュー結果の解析に失敗しました。' }, { status: 500 });
	}
};
