import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { z } from 'zod';

export const tools: Tool[] = [
	{
		name: 'get_help',
		description:
			'Get usage instructions / feature explanations. Called when the user asks things like "tell me how to use this", "what can this do?", "help", or "how do I use the ○○ feature?". If topic is omitted, returns a general overview',
		input_schema: {
			type: 'object',
			properties: {
				topic: {
					type: 'string',
					enum: ['overview', 'apps', 'tables', 'records', 'workflows', 'documents', 'email'],
					description: 'The topic to learn about (omit for a general overview)'
				}
			}
		}
	}
];

const getHelpInputSchema = z.object({
	topic: z.enum(['overview', 'apps', 'tables', 'records', 'workflows', 'documents', 'email']).optional()
});

const HELP: Record<string, object> = {
	overview: {
		title: 'Boann usage guide',
		description: 'An AI-first no-code platform: create apps from the UI, and simply describe your business needs in chat to handle table design, data management, workflow automation, and more.',
		features: [
			{ name: 'No-code app generation', topic: 'apps', examples: ['What tables are there?', 'Tell me how to create an app'] },
			{ name: 'Table management', topic: 'tables', examples: ['What tables are there?', 'Add a category field to the product management table'] },
			{ name: 'Record operations', topic: 'records', examples: ['Register a new product in inventory management', 'Show me the product list', 'Update the stock count for ○○'] },
			{ name: 'Workflow automation', topic: 'workflows', examples: ['Notify me every day at 9am about products low in stock', 'I want to create a workflow'] },
			{ name: 'Document generation (CSV/Markdown data)', topic: 'documents', examples: ['Put together the product list for Excel', 'Export the data as CSV'] },
			{ name: 'Sending email', topic: 'email', examples: ['Send an announcement email to ○○'] }
		],
		tips: [
			'Just give instructions in natural language',
			'To hear the detailed usage of a feature, ask something like "tell me how to use app creation"',
			'Data management and settings changes can also be done directly from "Data Management" / "Settings" in the side menu',
			'To delete a record, click a row in the list to open the detail dialog, then use the "Delete" button in the top right'
		],
		relatedPages: [
			{ label: 'App list', href: '/', description: 'You can directly manage the tables and data of the apps you created' },
			{ label: 'Settings', href: '/settings', description: 'You can change various app settings' }
		]
	},
	apps: {
		title: 'No-code app generation',
		description: 'Create a new app from the "Create App" button on the app list screen (create from scratch, or import from a file). After creation, adding tables and designing fields can also be requested via chat',
		operations: [
			{ action: 'Create a new app', description: 'Done from the "Create App" button on the app list screen (cannot be created via chat)', examples: ['Tell me how to create an app'] },
			{ action: 'Add a table', examples: ['Add an inventory management table to this app'] },
			{ action: 'Add a field', examples: ['Add a "person in charge" field to the inventory management table', 'Add a "category" column to product management'] },
			{ action: 'Relate to another table', examples: ['I want to link the deal management table to the customer table', 'Add a field to the order table to select a product'] }
		],
		tips: [
			'You can request table additions and field design via chat within the app screen (the AI proposes a configuration and asks for confirmation before creating it)',
			'Tables can be related to each other with a recordSelect field, or linked to an account (assignee) with an account field',
			'After creation, you can operate the data directly from the data management screen',
			'Field configuration changes can also be made from the data management schema editing screen'
		],
		relatedPages: [
			{ label: 'App list', href: '/', description: 'You can create apps, view the table list, and edit schemas' }
		]
	},
	tables: {
		title: 'Table management',
		description: 'You can view your created custom tables and add or remove fields',
		operations: [
			{ action: 'Check the table list', examples: ['What tables are there?', 'Show me the table list', 'Tell me the apps that have been created'] },
			{ action: 'Add a field', examples: ['Add a "△△" field to the ○○ table'] },
			{ action: 'Delete a table', description: 'Can be deleted from the data management schema editing screen', examples: ['I want to delete the ○○ table'] }
		],
		tips: [
			'Table names (identifiers) can only use lowercase letters, digits, and underscores',
			'System reserved words (accounts, workflows, etc.) cannot be used as table names'
		],
		relatedPages: [
			{ label: 'App list', href: '/', description: 'You can view the table list and edit schemas' }
		]
	},
	records: {
		title: 'Record operations',
		description: 'You can create, list, update, and delete data (records) in custom tables',
		operations: [
			{ action: 'Create a record', examples: ['Add a new product to inventory management', 'I want to register data in the ○○ table'] },
			{ action: 'View the record list', examples: ['Show me the product list', 'Show the data in the ○○ table'] },
			{ action: 'Update a record', examples: ['Change the stock count of ○○ to 10', 'Edit the ○○ record in the ○○ table'] },
			{ action: 'Delete a record', description: 'Click a row in the chat list or the data management list to open the detail dialog, then delete from the "Delete" button in the top right', examples: ['I want to delete the ○○ record'] }
		],
		tips: [
			'Records can also be created, edited, and deleted directly from the data management screen',
			'Clicking a row opens the detail dialog (also works in the list tables in chat)'
		],
		relatedPages: [
			{ label: 'App list', href: '/', description: 'You can list, create, edit, and delete records for each table' }
		]
	},
	workflows: {
		title: 'Workflow automation',
		description: 'You can create automation flows that run at a fixed time every day (notifications, aggregation, sending email, etc.)',
		operations: [
			{ action: 'Create a workflow', examples: ['Notify me every day at 9am about unprocessed ○○', 'I want to create a workflow', 'Create an automation flow that runs on a schedule'] },
			{ action: 'Check the workflow list', examples: ['What workflows are configured?', 'What workflows are there?'] },
			{ action: 'Edit a workflow', examples: ['Change the trigger time of the ○○ workflow', 'Add a step to the ○○ workflow'] }
		],
		tips: [
			'Triggers only support a fixed time each day',
			'Combine three kinds of steps: action (run a tool) / condition (branch) / foreach (repeat)',
			'You can enable/disable workflows and check run logs from the workflow management screen'
		],
		relatedPages: [
			{ label: 'App list', href: '/', description: 'You can view the workflow list per app, enable them, and check run logs' }
		]
	},
	documents: {
		title: 'Document generation (CSV / Markdown data export)',
		description: 'Exports table data in CSV or Markdown format, generating a source file that can be processed with Excel or AI tools',
		operations: [
			{ action: 'Export data as CSV', description: 'Tabular data that can be opened in Excel', examples: ['Export the product list as CSV', 'Put together the ○○ table data for Excel'] },
			{ action: 'Generate a Markdown report', description: 'A report mixing prose and multiple tables', examples: ['Create a summary report for ○○', 'Generate the monthly summary in Markdown'] }
		],
		tips: [
			'Generated files can be obtained from the download link',
			'These are source files meant for processing with external tools like Excel, ChatGPT, or Copilot',
			'If you describe the specific processing you need, a prompt for external AI tools will also be generated alongside it'
		]
	},
	email: {
		title: 'Sending email',
		operations: [
			{ action: 'Compose and send an email', examples: ['Send an announcement email to ○○', 'Write a follow-up email to the person in charge of △△', 'Compose a confirmation email'] }
		],
		tips: [
			'The AI drafts the email, and you review/edit the content in a form before sending',
			'On first use, you need to configure the email service in the email settings screen'
		],
		relatedPages: [
			{ label: 'Email settings', href: '/settings/email', description: 'You can configure the email sending service' }
		]
	}
};

export function handleGetHelp(input: unknown) {
	const { topic } = getHelpInputSchema.parse(input ?? {});
	return HELP[topic ?? 'overview'];
}
