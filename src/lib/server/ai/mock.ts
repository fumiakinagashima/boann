import type { MessageContent } from '$lib/types/chat';

const MOCK_RESPONSES: MessageContent[][] = [
	[
		{ type: 'text', text: 'I\'ll create the app. Is it OK to create an "Inventory Management" table with the following field configuration?' },
		{
			type: 'table',
			columns: [
				{ key: 'label', label: 'Field name' },
				{ key: 'type', label: 'Type' },
				{ key: 'required', label: 'Required' }
			],
			rows: [
				{ label: 'Product name', type: 'Text', required: 'Required' },
				{ label: 'Stock', type: 'Number', required: 'Optional' },
				{ label: 'Unit price', type: 'Number', required: 'Optional' },
				{ label: 'Category', type: 'Select', required: 'Optional' }
			]
		}
	],
	[
		{ type: 'text', text: 'Here is the list of registered tables.' },
		{
			type: 'table',
			columns: [
				{ key: 'icon', label: '' },
				{ key: 'label', label: 'Table name' },
				{ key: 'name', label: 'Identifier' }
			],
			rows: [
				{ icon: '📦', label: 'Inventory Management', name: 'inventory' },
				{ icon: '📋', label: 'Task Management', name: 'tasks' },
				{ icon: '📞', label: 'Inquiry Management', name: 'inquiries' }
			]
		}
	],
	[
		{ type: 'text', text: 'Hello! This is Boann. How can I help you?' }
	]
];

let mockIndex = 0;

export function mockChat(): MessageContent[] {
	const contents = MOCK_RESPONSES[mockIndex % MOCK_RESPONSES.length];
	mockIndex++;
	return contents;
}
