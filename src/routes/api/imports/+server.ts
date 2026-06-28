import { json } from '@sveltejs/kit';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';
import { createImportJob } from '$lib/server/db/import-job-service';
import type { ImportJobMessage } from '$lib/server/imports/types';
import type { RequestHandler } from './$types';

// テキスト系ファイルの取り込み。アップロードを受け取りドラフトを作成し、
// 設計（読み取り＋AIプラン生成）を Queue で非同期に行う。
// Excel/CSV/PDF/画像は別フェーズで対応する。
const MAX_BYTES = 1024 * 1024; // 1MB

const ALLOWED_EXT = ['.txt', '.md', '.markdown'];

function isAllowed(name: string, type: string): boolean {
	const lower = name.toLowerCase();
	return ALLOWED_EXT.some((ext) => lower.endsWith(ext)) || type.startsWith('text/');
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('D1データベースが設定されていません');
	if (!platform.env.QUEUE) return errors.serviceUnavailable('Queue が設定されていません');
	const accountId = locals.account?.id;
	if (!accountId) return errors.forbidden();

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return errors.badRequest('multipart/form-data 形式で送信してください');
	}

	const file = form.get('file');
	if (!(file instanceof File)) return errors.badRequest('ファイルが添付されていません');
	if (file.size === 0) return errors.badRequest('空のファイルです');
	if (file.size > MAX_BYTES) return errors.badRequest('ファイルサイズが大きすぎます（最大1MB）');
	if (!isAllowed(file.name, file.type)) {
		return errors.badRequest('現在はテキスト/Markdown（.txt, .md）のみ対応しています');
	}

	let content: string;
	try {
		content = await file.text();
	} catch {
		return errors.badRequest('ファイルを読み取れませんでした');
	}

	const db = createDb(platform.env.DB);
	const job = await createImportJob(db, { accountId, filename: file.name, content });

	const message: ImportJobMessage = { type: 'design', jobId: job.id };
	await platform.env.QUEUE.send(message);

	return json({ jobId: job.id, status: job.status }, { status: 202 });
};
