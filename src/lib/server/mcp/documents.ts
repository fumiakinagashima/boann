import { z } from 'zod';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { uploadR2 } from '../r2-service';
import type { ToolEnv } from './shared';

// AIに公開するツール（旧・直接生成ツールは非公開化済み）
export const tools: Tool[] = [
	{
		name: 'build_handoff_data',
		description:
			'DBから取得したデータをCSV/Markdownファイルに整形してR2に保存し、ダウンロードリンクと外部AIツール向けのプロンプトをセットで返す。「Excelにまとめて」「資料を作って」などの資料作成依頼に使う。事前に get_entities 等のツールでデータを取得し、その内容を tables に構成して渡す。',
		input_schema: {
			type: 'object',
			properties: {
				filename: {
					type: 'string',
					description: 'ファイル名（拡張子なし。例: "2026年6月_案件一覧"）'
				},
				format: {
					type: 'string',
					enum: ['csv', 'markdown'],
					description: 'csv: 表形式データ（Excel等で開く）/ markdown: 文章・複数テーブル混在に向く'
				},
				tables: {
					type: 'array',
					description: 'テーブルの配列（CSV形式の場合は複数テーブルを連結、Markdown形式の場合は ## 見出し区切り）',
					items: {
						type: 'object',
						properties: {
							title: { type: 'string', description: 'テーブルのタイトル（任意）' },
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
								items: { type: 'object', description: '列キー: 値の組' }
							}
						},
						required: ['columns', 'rows']
					}
				},
				prompt: {
					type: 'string',
					description: 'このデータファイルをCopilot/Canvas/ChatGPT等の外部AIツールに渡す際のプロンプト（日本語で、ユーザーがそのままコピペして使える内容にする）'
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
	if (!env?.R2) throw new Error('R2が設定されていないためデータファイルを保存できません');
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

