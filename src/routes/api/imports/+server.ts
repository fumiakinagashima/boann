import { json } from '@sveltejs/kit';
import { errors } from '$lib/server/errors';
import type { RequestHandler } from './$types';

// テキスト系ファイルの取り込み（アプリ生成の種）。
// 現状は txt/md のみ対応し、内容をそのまま読み取って返す。
// Excel/CSV/PDF/画像は別フェーズ（パース層・Claude vision）で対応する。
const MAX_BYTES = 1024 * 1024; // 1MB

const ALLOWED = [
	{ ext: '.txt', mime: 'text/plain' },
	{ ext: '.md', mime: 'text/markdown' },
	{ ext: '.markdown', mime: 'text/markdown' }
];

function isAllowed(name: string, type: string): boolean {
	const lower = name.toLowerCase();
	return ALLOWED.some((a) => lower.endsWith(a.ext)) || type.startsWith('text/');
}

export const POST: RequestHandler = async ({ request }) => {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return errors.badRequest('multipart/form-data 形式で送信してください');
	}

	const file = form.get('file');
	if (!(file instanceof File)) {
		return errors.badRequest('ファイルが添付されていません');
	}
	if (file.size === 0) {
		return errors.badRequest('空のファイルです');
	}
	if (file.size > MAX_BYTES) {
		return errors.badRequest('ファイルサイズが大きすぎます（最大1MB）');
	}
	if (!isAllowed(file.name, file.type)) {
		return errors.badRequest('現在はテキスト/Markdown（.txt, .md）のみ対応しています');
	}

	let content: string;
	try {
		content = await file.text();
	} catch {
		return errors.badRequest('ファイルを読み取れませんでした');
	}

	return json({ filename: file.name, size: file.size, content });
};
