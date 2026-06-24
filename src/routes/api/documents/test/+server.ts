import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { errors } from '$lib/server/errors';
import {
	generateExcelWorkbook,
	generateWordDocument,
	generatePowerpointPresentation,
	saveGeneratedDocument
} from '$lib/server/documents';

const MESSAGE = 'こんにちは！Middleton！';

const requestSchema = z.object({ format: z.enum(['docx', 'xlsx', 'pptx']) });

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.R2) return errors.serviceUnavailable('R2が設定されていません');

	const { format } = requestSchema.parse(await request.json());

	if (format === 'docx') {
		const buffer = await generateWordDocument({
			title: 'テスト文書',
			blocks: [{ type: 'paragraph', text: MESSAGE }]
		});
		const link = await saveGeneratedDocument(platform.env.R2, buffer, 'こんにちは.docx', 'docx');
		return json(link);
	} else if (format === 'xlsx') {
		const buffer = await generateExcelWorkbook([
			{ name: 'Sheet1', columns: [{ key: 'message', label: 'メッセージ' }], rows: [{ message: MESSAGE }] }
		]);
		const link = await saveGeneratedDocument(platform.env.R2, buffer, 'こんにちは.xlsx', 'xlsx');
		return json(link);
	} else if (format === 'pptx') {
		const buffer = await generatePowerpointPresentation({
			title: 'テスト',
			slides: [{ title: 'テスト', body: [MESSAGE] }]
		});
		const link = await saveGeneratedDocument(platform.env.R2, buffer, 'こんにちは.pptx', 'pptx');
		return json(link);
	}

	return errors.badRequest('format は docx / xlsx / pptx のいずれかを指定してください');
};
