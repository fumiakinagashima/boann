import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import { JP_FONT } from './fonts';

export type WordTableBlock = {
	type: 'table';
	columns: { key: string; label: string }[];
	rows: Record<string, unknown>[];
};

export type WordBlock =
	| { type: 'heading'; level?: 1 | 2 | 3; text: string }
	| { type: 'paragraph'; text: string }
	| WordTableBlock;

export type WordDocumentInput = {
	title?: string;
	blocks: WordBlock[];
};

const HEADING_LEVELS = {
	1: HeadingLevel.HEADING_1,
	2: HeadingLevel.HEADING_2,
	3: HeadingLevel.HEADING_3
} as const;

function buildTable(block: WordTableBlock): Table {
	const headerRow = new TableRow({
		children: block.columns.map(
			(col) =>
				new TableCell({
					children: [new Paragraph({ children: [new TextRun({ text: col.label, bold: true })] })]
				})
		)
	});
	const dataRows = block.rows.map(
		(row) =>
			new TableRow({
				children: block.columns.map(
					(col) => new TableCell({ children: [new Paragraph(String(row[col.key] ?? ''))] })
				)
			})
	);
	return new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

export async function generateWordDocument(input: WordDocumentInput): Promise<ArrayBuffer> {
	const children: (Paragraph | Table)[] = [];

	if (input.title) {
		children.push(new Paragraph({ text: input.title, heading: HeadingLevel.TITLE }));
	}

	for (const block of input.blocks) {
		if (block.type === 'heading') {
			children.push(new Paragraph({ text: block.text, heading: HEADING_LEVELS[block.level ?? 1] }));
		} else if (block.type === 'paragraph') {
			children.push(new Paragraph({ text: block.text }));
		} else {
			children.push(buildTable(block));
		}
	}

	const doc = new Document({
		styles: { default: { document: { run: { font: JP_FONT } } } },
		sections: [{ children }]
	});

	return Packer.toArrayBuffer(doc);
}
