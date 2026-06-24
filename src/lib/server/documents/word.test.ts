import { describe, it, expect } from 'vitest';
import { generateWordDocument } from './word';
import { extractZipText } from './test-utils';

describe('generateWordDocument', () => {
	it('generates a valid docx with Japanese content', async () => {
		const buffer = await generateWordDocument({
			title: '会議資料',
			blocks: [
				{ type: 'heading', level: 1, text: '進捗概要' },
				{ type: 'paragraph', text: '今月の商談数は前月比で増加しました。' },
				{
					type: 'table',
					columns: [
						{ key: 'name', label: '案件名' },
						{ key: 'status', label: '状態' }
					],
					rows: [{ name: '新規導入案件', status: '商談中' }]
				}
			]
		});

		const bytes = new Uint8Array(buffer);
		expect(bytes[0]).toBe(0x50);
		expect(bytes[1]).toBe(0x4b);

		const text = await extractZipText(buffer);
		expect(text).toContain('会議資料');
		expect(text).toContain('進捗概要');
		expect(text).toContain('案件名');
	});
});
