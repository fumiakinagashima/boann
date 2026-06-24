import ExcelJS from 'exceljs';
import { JP_FONT } from './fonts';

export type ExcelSheet = {
	name: string;
	columns: { key: string; label: string; width?: number }[];
	rows: Record<string, unknown>[];
};

export async function generateExcelWorkbook(sheets: ExcelSheet[]): Promise<ArrayBuffer> {
	const workbook = new ExcelJS.Workbook();

	for (const sheet of sheets) {
		const worksheet = workbook.addWorksheet(sheet.name);
		worksheet.columns = sheet.columns.map((col) => ({
			key: col.key,
			header: col.label,
			width: col.width ?? 16
		}));
		worksheet.getRow(1).font = { name: JP_FONT, bold: true };

		for (const row of sheet.rows) {
			worksheet.addRow(row).font = { name: JP_FONT };
		}
	}

	const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array;
	return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}
