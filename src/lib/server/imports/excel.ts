import ExcelJS from 'exceljs';

// Excel ワークブックを AI 設計プロンプト向けのテキストに変換する。
// 実データの投入はせず、シート構成・見出し・サンプル行のみを抽出して
// テーブル/フィールド設計の参考情報とする（txt/md と同じ「設計のみ」の枠組みに載せる）。
const MAX_SHEETS = 10;
const MAX_SAMPLE_ROWS = 5;
const MAX_CONTENT_CHARS = 20000;

function cellText(value: ExcelJS.CellValue): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'object') {
		if ('text' in value && typeof value.text === 'string') return value.text;
		if ('result' in value) return String(value.result ?? '');
		if (value instanceof Date) return value.toISOString().slice(0, 10);
		return '';
	}
	return String(value);
}

export async function extractExcelContent(buffer: ArrayBuffer, filename: string): Promise<string> {
	const workbook = new ExcelJS.Workbook();
	await workbook.xlsx.load(buffer);

	const sheets = workbook.worksheets.slice(0, MAX_SHEETS);
	if (sheets.length === 0) throw new Error('シートが見つかりませんでした');

	const parts: string[] = [`ファイル名: ${filename}`, `シート数: ${workbook.worksheets.length}`];
	if (workbook.worksheets.length > sheets.length) {
		parts.push(`（先頭 ${sheets.length} シートのみ抽出）`);
	}

	for (const sheet of sheets) {
		const rows = sheet.getRows(1, Math.min(sheet.rowCount, MAX_SAMPLE_ROWS + 1)) ?? [];
		if (rows.length === 0) continue;

		const [headerRow, ...dataRows] = rows;
		const headers = headerRow.values instanceof Array
			? headerRow.values.slice(1).map(cellText)
			: [];
		if (headers.every((h) => h === '')) continue;

		parts.push(`\n--- シート: ${sheet.name}（${Math.max(sheet.rowCount - 1, 0)}行のデータ） ---`);
		parts.push(`見出し: ${headers.join(' | ')}`);
		for (const row of dataRows) {
			const values = row.values instanceof Array ? row.values.slice(1).map(cellText) : [];
			parts.push(`例: ${values.join(' | ')}`);
		}
	}

	const content = parts.join('\n');
	return content.length > MAX_CONTENT_CHARS
		? content.slice(0, MAX_CONTENT_CHARS) + '\n…（以下省略）'
		: content;
}
