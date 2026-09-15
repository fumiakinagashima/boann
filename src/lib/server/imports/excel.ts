import ExcelJS from 'exceljs';

// Converts an Excel workbook into text for the AI design prompt.
// Does not import the actual data; it only extracts the sheet structure, headers, and sample rows
// as reference information for table/field design (fitting into the same "design only" framework as txt/md).
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
	if (sheets.length === 0) throw new Error('No sheets were found');

	const parts: string[] = [`File name: ${filename}`, `Sheet count: ${workbook.worksheets.length}`];
	if (workbook.worksheets.length > sheets.length) {
		parts.push(`(only the first ${sheets.length} sheets extracted)`);
	}

	for (const sheet of sheets) {
		const rows = sheet.getRows(1, Math.min(sheet.rowCount, MAX_SAMPLE_ROWS + 1)) ?? [];
		if (rows.length === 0) continue;

		const [headerRow, ...dataRows] = rows;
		const headers = headerRow.values instanceof Array
			? headerRow.values.slice(1).map(cellText)
			: [];
		if (headers.every((h) => h === '')) continue;

		parts.push(`\n--- Sheet: ${sheet.name} (${Math.max(sheet.rowCount - 1, 0)} rows of data) ---`);
		parts.push(`Headers: ${headers.join(' | ')}`);
		for (const row of dataRows) {
			const values = row.values instanceof Array ? row.values.slice(1).map(cellText) : [];
			parts.push(`Example: ${values.join(' | ')}`);
		}
	}

	const content = parts.join('\n');
	return content.length > MAX_CONTENT_CHARS
		? content.slice(0, MAX_CONTENT_CHARS) + '\n…(truncated)'
		: content;
}
