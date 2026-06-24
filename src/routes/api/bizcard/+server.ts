import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

export type BizcardResult = {
	name: string | null;
	company: string | null;
	title: string | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	website: string | null;
};

const PROMPT = `この画像に写っている名刺を全て読み取り、1枚ずつ情報を抽出して JSON 配列で返してください。
名刺が1枚だけの場合も必ず配列（要素1つ）で返してください。
情報がない項目は null にしてください。説明文・マークダウン記法は不要です。

[
  {
    "name": "氏名（フルネーム）",
    "company": "会社名・組織名",
    "title": "役職・肩書き",
    "email": "メールアドレス",
    "phone": "電話番号（最初の1件）",
    "address": "住所",
    "website": "WebサイトURL"
  }
]`;

export const POST: RequestHandler = async ({ request, platform }) => {
	const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) {
		return json({ error: 'ANTHROPIC_API_KEY が設定されていません。' }, { status: 500 });
	}

	const formData = await request.formData();
	const file = formData.get('image') as File | null;
	if (!file || !file.type.startsWith('image/')) {
		return json({ error: '画像ファイルを選択してください。' }, { status: 400 });
	}

	const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
	if (!allowed.includes(file.type)) {
		return json({ error: 'JPEG・PNG・GIF・WEBP のみ対応しています。' }, { status: 400 });
	}

	// base64 変換（チャンク化で高速化）
	const arrayBuffer = await file.arrayBuffer();
	const bytes = new Uint8Array(arrayBuffer);
	const CHUNK = 8192;
	const parts: string[] = [];
	for (let i = 0; i < bytes.length; i += CHUNK) {
		parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
	}
	const base64 = btoa(parts.join(''));

	// Claude API 呼び出し（20秒タイムアウト）
	const anthropic = new Anthropic({ apiKey, timeout: 20000 });
	let text = '';
	try {
		const message = await anthropic.messages.create({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 512,
			messages: [
				{
					role: 'user',
					content: [
						{
							type: 'image',
							source: {
								type: 'base64',
								media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
								data: base64
							}
						},
						{ type: 'text', text: PROMPT }
					]
				}
			]
		});
		text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: `AIエラー: ${msg}` }, { status: 500 });
	}

	const jsonMatch = text.match(/\[[\s\S]*\]/);
	if (!jsonMatch) {
		return json({ error: `情報の抽出に失敗しました。(response: ${text.slice(0, 100)})` }, { status: 500 });
	}

	try {
		const results = JSON.parse(jsonMatch[0]) as BizcardResult[];
		return json({ results });
	} catch {
		return json({ error: 'レスポンスの解析に失敗しました。' }, { status: 500 });
	}
};
