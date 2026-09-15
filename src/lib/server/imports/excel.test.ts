import { describe, it, expect } from 'vitest';
import { generateExcelWorkbook } from '../documents/excel';
import { extractExcelContent } from './excel';

describe('extractExcelContent', () => {
	it('extracts sheet name, headers and sample rows', async () => {
		const buffer = await generateExcelWorkbook([
			{
				name: '顧客一覧',
				columns: [
					{ key: 'name', label: '顧客名' },
					{ key: 'email', label: 'メール' }
				],
				rows: [
					{ name: '株式会社サンプル', email: 'sample@example.com' },
					{ name: '合同会社テスト', email: 'test@example.com' }
				]
			}
		]);

		const content = await extractExcelContent(buffer, '顧客一覧.xlsx');

		expect(content).toContain('顧客一覧');
		expect(content).toContain('顧客名 | メール');
		expect(content).toContain('株式会社サンプル | sample@example.com');
	});

	it('keeps a sheet that has headers but no data rows', async () => {
		const buffer = await generateExcelWorkbook([
			{ name: '空シート', columns: [{ key: 'x', label: 'X' }], rows: [] }
		]);

		const content = await extractExcelContent(buffer, 'empty.xlsx');
		expect(content).toContain('Headers: X');
	});

	it('throws when the workbook has no sheets', async () => {
		const buffer = await generateExcelWorkbook([]);
		await expect(extractExcelContent(buffer, 'blank.xlsx')).rejects.toThrow();
	});
});
