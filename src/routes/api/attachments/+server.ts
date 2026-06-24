import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uploadR2 } from '$lib/server/r2-service';
import { errors } from '$lib/server/errors';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB server-side limit

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.R2) return errors.serviceUnavailable('R2が設定されていません。wrangler.toml を確認してください。');

	const contentLength = Number(request.headers.get('content-length') ?? 0);
	if (contentLength > MAX_BYTES) return errors.badRequest('ファイルが大きすぎます（最大10MB）');

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return errors.badRequest('フォームデータの解析に失敗しました');
	}

	const file = formData.get('file');
	if (!(file instanceof File)) return errors.badRequest('file フィールドが必要です');
	if (file.size > MAX_BYTES) return errors.badRequest('ファイルが大きすぎます（最大10MB）');

	const key = crypto.randomUUID();
	const buffer = await file.arrayBuffer();
	await uploadR2(platform.env.R2, key, buffer, { contentType: file.type || 'application/octet-stream' });

	return json({ key, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size }, { status: 201 });
};
