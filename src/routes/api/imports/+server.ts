import { json } from '@sveltejs/kit';
import { errors } from '$lib/server/errors';
import { createDb } from '$lib/server/db';
import { createImportJob } from '$lib/server/db/import-job-service';
import { extractExcelContent } from '$lib/server/imports/excel';
import type { ImportJobMessage } from '$lib/server/imports/types';
import type { RequestHandler } from './$types';

// Import of text-type/Excel files. Accepts the upload, creates a draft, and performs
// the design step (reading + AI plan generation) asynchronously via a Queue.
// CSV/PDF/images will be handled in a separate phase.
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
	if (!platform?.env?.DB) return errors.serviceUnavailable('D1 database is not configured');
	if (!platform.env.QUEUE) return errors.serviceUnavailable('Queue is not configured');
	const accountId = locals.account?.id;
	if (!accountId) return errors.forbidden();

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return errors.badRequest('Please submit in multipart/form-data format');
	}

	const file = form.get('file');
	if (!(file instanceof File)) return errors.badRequest('No file attached');
	if (file.size === 0) return errors.badRequest('The file is empty');
	if (file.size > MAX_BYTES) return errors.badRequest('File size is too large (max 5MB)');

	const text = isText(file.name, file.type);
	const excel = !text && isExcel(file.name, file.type);
	if (!text && !excel) {
		return errors.badRequest('Currently only text/Markdown (.txt, .md) and Excel (.xlsx) are supported');
	}

	let content: string;
	try {
		content = text ? await file.text() : await extractExcelContent(await file.arrayBuffer(), file.name);
	} catch {
		return errors.badRequest('Failed to read the file');
	}

	const db = createDb(platform.env.DB);
	const job = await createImportJob(db, { accountId, filename: file.name, content });

	const message: ImportJobMessage = { type: 'design', jobId: job.id };
	await platform.env.QUEUE.send(message);

	return json({ jobId: job.id, status: job.status }, { status: 202 });
};
