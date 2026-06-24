import { describe, it, expect } from 'vitest';
import { generatePowerpointPresentation } from './powerpoint';
import { extractZipText } from './test-utils';

describe('generatePowerpointPresentation', () => {
	it('generates a valid pptx with Japanese content', async () => {
		const buffer = await generatePowerpointPresentation({
			title: '提案資料',
			slides: [
				{
					title: '導入効果',
					body: ['業務時間を削減', '入力ミスを防止']
				},
				{
					title: '料金プラン',
					table: {
						columns: [
							{ key: 'plan', label: 'プラン名' },
							{ key: 'price', label: '価格' }
						],
						rows: [{ plan: 'スタンダード', price: '50,000円' }]
					}
				}
			]
		});

		const bytes = new Uint8Array(buffer);
		expect(bytes[0]).toBe(0x50);
		expect(bytes[1]).toBe(0x4b);

		const text = await extractZipText(buffer);
		expect(text).toContain('提案資料');
		expect(text).toContain('導入効果');
		expect(text).toContain('プラン名');
	});
});
