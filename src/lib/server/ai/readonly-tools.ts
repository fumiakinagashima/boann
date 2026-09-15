import { tools } from '$lib/server/tools';

// The set of tool names that only allow retrieving information. Shared by auxiliary chats —
// such as form-input support and workflow-building support — where we don't want data to be created, updated, or deleted.
export const READONLY_TOOL_NAMES = new Set([
	'list_integrations',
	'list_entity_types',
	'get_entity_fields',
	'get_entities',
	'get_help'
]);

export const readonlyTools = tools.filter((t) => READONLY_TOOL_NAMES.has(t.name));
