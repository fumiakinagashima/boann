import type { LinkContent } from '$lib/types/chat';
import { uploadR2 } from '$lib/server/r2-service';
import { DOCUMENT_MIME_TYPES, type DocumentFormat } from './mime';

export async function saveGeneratedDocument(
	r2: R2Bucket,
	buffer: ArrayBuffer,
	filename: string,
	format: DocumentFormat
): Promise<LinkContent> {
	const key = crypto.randomUUID();
	await uploadR2(r2, key, buffer, { contentType: DOCUMENT_MIME_TYPES[format] });

	return {
		type: 'link',
		label: filename,
		href: `/api/attachments/${key}?filename=${encodeURIComponent(filename)}`,
		newTab: true
	};
}
