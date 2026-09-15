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

const MESSAGE = 'Hello, Middleton!';

const requestSchema = z.object({ format: z.enum(['docx', 'xlsx', 'pptx']) });

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.R2) return errors.serviceUnavailable('R2 is not configured');

	const { format } = requestSchema.parse(await request.json());

	if (format === 'docx') {
		const buffer = await generateWordDocument({
			title: 'Test Document',
			blocks: [{ type: 'paragraph', text: MESSAGE }]
		});
		const link = await saveGeneratedDocument(platform.env.R2, buffer, 'hello.docx', 'docx');
		return json(link);
	} else if (format === 'xlsx') {
		const buffer = await generateExcelWorkbook([
			{ name: 'Sheet1', columns: [{ key: 'message', label: 'Message' }], rows: [{ message: MESSAGE }] }
		]);
		const link = await saveGeneratedDocument(platform.env.R2, buffer, 'hello.xlsx', 'xlsx');
		return json(link);
	} else if (format === 'pptx') {
		const buffer = await generatePowerpointPresentation({
			title: 'Test',
			slides: [{ title: 'Test', body: [MESSAGE] }]
		});
		const link = await saveGeneratedDocument(platform.env.R2, buffer, 'hello.pptx', 'pptx');
		return json(link);
	}

	return errors.badRequest('format must be one of docx / xlsx / pptx');
};
