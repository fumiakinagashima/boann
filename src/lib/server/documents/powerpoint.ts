import PptxGenJS from 'pptxgenjs';
import { JP_FONT } from './fonts';

export type PptTableBlock = {
	columns: { key: string; label: string }[];
	rows: Record<string, unknown>[];
};

export type PptSlide = {
	title?: string;
	body?: string[];
	table?: PptTableBlock;
};

export type PowerpointInput = {
	title?: string;
	slides: PptSlide[];
};

function buildTable(table: PptTableBlock): PptxGenJS.TableRow[] {
	const headerRow: PptxGenJS.TableRow = table.columns.map((col) => ({
		text: col.label,
		options: { bold: true, fill: { color: 'F1F1F1' } }
	}));
	const dataRows: PptxGenJS.TableRow[] = table.rows.map((row) =>
		table.columns.map((col) => ({ text: String(row[col.key] ?? '') }))
	);
	return [headerRow, ...dataRows];
}

export async function generatePowerpointPresentation(input: PowerpointInput): Promise<ArrayBuffer> {
	const pptx = new PptxGenJS();
	pptx.theme = { headFontFace: JP_FONT, bodyFontFace: JP_FONT };

	if (input.title) {
		const titleSlide = pptx.addSlide();
		titleSlide.addText(input.title, {
			x: 0.5,
			y: 2.2,
			w: '90%',
			h: 1,
			fontSize: 32,
			bold: true,
			align: 'center'
		});
	}

	for (const slide of input.slides) {
		const s = pptx.addSlide();
		let y = 0.4;

		if (slide.title) {
			s.addText(slide.title, { x: 0.5, y, w: '90%', h: 0.7, fontSize: 24, bold: true });
			y += 0.9;
		}

		if (slide.body?.length) {
			s.addText(
				slide.body.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
				{ x: 0.5, y, w: '90%', h: 3, fontSize: 16 }
			);
			y += 3;
		}

		if (slide.table) {
			s.addTable(buildTable(slide.table), { x: 0.5, y, w: '90%', fontSize: 12 });
		}
	}

	const data = await pptx.write({ outputType: 'arraybuffer' });
	return data as ArrayBuffer;
}
