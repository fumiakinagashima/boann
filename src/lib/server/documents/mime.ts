export const DOCUMENT_MIME_TYPES = {
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
} as const;

export type DocumentFormat = keyof typeof DOCUMENT_MIME_TYPES;
