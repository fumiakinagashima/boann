import { describe, it, expect } from 'vitest';
import { generateExcelWorkbook } from './excel';
import { extractZipText } from './test-utils';

describe('generateExcelWorkbook', () => {
	it('generates a valid xlsx with Japanese content', async () => {
		const buffer = await generateExcelWorkbook([
			{
				name: '売上一覧',
				columns: [
					{ key: 'name', label: '顧客名' },
					{ key: 'amount', label: '金額' }
				],
				rows: [
					{ name: '株式会社サンプル', amount: 100000 },
					{ name: '合同会社テスト', amount: 50000 }
				]
			}
		]);

		const bytes = new Uint8Array(buffer);
		expect(bytes[0]).toBe(0x50); // 'P'
		expect(bytes[1]).toBe(0x4b); // 'K'

		const text = await extractZipText(buffer);
		expect(text).toContain('顧客名');
		expect(text).toContain('株式会社サンプル');
	});
});
