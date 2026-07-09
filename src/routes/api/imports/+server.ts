import { json } from '@sveltejs/kit';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';
import { createImportJob } from '$lib/server/db/import-job-service';
import { extractExcelContent } from '$lib/server/imports/excel';
import type { ImportJobMessage } from '$lib/server/imports/types';
import type { RequestHandler } from './$types';

// テキスト系/Excelファイルの取り込み。アップロードを受け取りドラフトを作成し、
// 設計（読み取り＋AIプラン生成）を Queue で非同期に行う。
// CSV/PDF/画像は別フェーズで対応する。
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const TEXT_EXT = ['.txt', '.md', '.markdown'];
const EXCEL_EXT = ['.xlsx'];

function isText(name: string, type: string): boolean {
	const lower = name.toLowerCase();
	return TEXT_EXT.some((ext) => lower.endsWith(ext)) || type.startsWith('text/');
}

function isExcel(name: string, type: string): boolean {
	const lower = name.toLowerCase();
	return EXCEL_EXT.some((ext) => lower.endsWith(ext)) ||
		type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
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
	if (file.size > MAX_BYTES) return errors.badRequest('ファイルサイズが大きすぎます（最大5MB）');

	const text = isText(file.name, file.type);
	const excel = !text && isExcel(file.name, file.type);
	if (!text && !excel) {
		return errors.badRequest('現在はテキスト/Markdown（.txt, .md）、Excel（.xlsx）のみ対応しています');
	}

	let content: string;
	try {
		content = text ? await file.text() : await extractExcelContent(await file.arrayBuffer(), file.name);
	} catch {
		return errors.badRequest('ファイルを読み取れませんでした');
	}

	const db = createDb(platform.env.DB);
	const job = await createImportJob(db, { accountId, filename: file.name, content });

	const message: ImportJobMessage = { type: 'design', jobId: job.id };
	await platform.env.QUEUE.send(message);

	return json({ jobId: job.id, status: job.status }, { status: 202 });
};
