import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { uploadR2 } from '../r2-service';
import type { ToolEnv } from './shared';

// Tools exposed to the AI (the old direct-generation tools have been made private)
export const tools: Tool[] = [
	{
		name: 'build_handoff_data',
		description:
			'Formats data retrieved from the DB into a CSV/Markdown file, saves it to R2, and returns a download link together with a prompt for external AI tools. Use this for document-creation requests like "put this together for Excel" or "make me a document". Fetch the data beforehand with a tool such as get_entities, then structure its content into tables and pass it in.',
		input_schema: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'File name (without extension, e.g. "June_2026_Deal_List")'
				},
				format: {
					type: 'string',
					enum: ['csv', 'markdown'],
					description: 'csv: tabular data (opened in Excel etc.) / markdown: suited for prose mixed with multiple tables'
				},
				tables: {
					type: 'array',
					description: 'Array of tables (for CSV format, multiple tables are concatenated; for Markdown format, separated by ## headings)',
					items: {
						type: 'object',
						properties: {
							title: { type: 'string', description: 'Table title (optional)' },
							columns: {
								type: 'array',
								items: {
									type: 'object',
									properties: { key: { type: 'string' }, label: { type: 'string' } },
									required: ['key', 'label']
								}
							},
							rows: {
								type: 'array',
								items: { type: 'object', description: 'Column key: value pairs' }
							}
						},
						required: ['columns', 'rows']
					}
				},
				prompt: {
					type: 'string',
					description: 'The prompt to use when handing this data file off to an external AI tool such as Copilot/Canvas/ChatGPT (write it so the user can copy and paste it as-is)'
				}
			},
			required: ['filename', 'format', 'tables', 'prompt']
		}
	}
];

// --- build_handoff_data ---

const handoffTableSchema = z.object({
	title: z.string().optional(),
	columns: z.array(z.object({ key: z.string(), label: z.string() })),
	rows: z.array(z.record(z.string(), z.unknown()))
});

const buildHandoffDataSchema = z.object({
	filename: z.string().min(1),
	format: z.enum(['csv', 'markdown']),
	tables: z.array(handoffTableSchema).min(1),
	prompt: z.string().min(1)
});

function tablesToCsv(tables: z.infer<typeof handoffTableSchema>[]): string {
	return tables
		.map((t) => {
			const headerRow = t.columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
			const dataRows = t.rows.map((row) =>
				t.columns
					.map((c) => {
						const v = row[c.key];
						if (v == null) return '';
						return `"${String(v).replace(/"/g, '""')}"`;
					})
					.join(',')
			);
			return [t.title ? `"${t.title}"` : '', headerRow, ...dataRows].filter(Boolean).join('\r\n');
		})
		.join('\r\n\r\n');
}

function tablesToMarkdown(tables: z.infer<typeof handoffTableSchema>[]): string {
	return tables
		.map((t) => {
			const parts: string[] = [];
			if (t.title) parts.push(`## ${t.title}\n`);
			const header = '| ' + t.columns.map((c) => c.label).join(' | ') + ' |';
			const sep = '| ' + t.columns.map(() => '---').join(' | ') + ' |';
			const dataRows = t.rows.map(
				(row) => '| ' + t.columns.map((c) => String(row[c.key] ?? '')).join(' | ') + ' |'
			);
			parts.push([header, sep, ...dataRows].join('\n'));
			return parts.join('\n');
		})
		.join('\n\n');
}

export async function handleBuildHandoffData(input: unknown, env?: ToolEnv) {
	if (!env?.R2) throw new Error('Cannot save the data file because R2 is not configured');
	const { filename, format, tables, prompt } = buildHandoffDataSchema.parse(input);

	const ext = format === 'csv' ? 'csv' : 'md';
	const fullFilename = `${filename}.${ext}`;
	const content = format === 'csv' ? tablesToCsv(tables) : tablesToMarkdown(tables);
	const contentType = format === 'csv' ? 'text/csv; charset=utf-8' : 'text/markdown; charset=utf-8';

	const key = crypto.randomUUID();
	const buf = new TextEncoder().encode(content).buffer;
	await uploadR2(env.R2, key, buf as ArrayBuffer, { contentType });

	const downloadUrl = `/api/attachments/${key}?filename=${encodeURIComponent(fullFilename)}`;
	const label = `${filename} (${format.toUpperCase()})`;

	return { type: 'doc_handoff', downloadUrl, filename: fullFilename, label, prompt };
}

