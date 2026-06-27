import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import * as integrations from './integrations';
import * as communication from './communication';
import * as documents from './documents';
import * as entities from './entities';
import * as help from './help';
import * as workflows from './workflows';

export type { ToolEnv } from './shared';

export type ToolName =
	| 'list_integrations'
	| 'call_external_api'
	| 'build_handoff_data'
	| 'delete_read_notifications'
	| 'send_email'
	| 'send_notification'
	| 'send_slack_notification'
	| 'list_entity_types'
	| 'create_app'
	| 'get_entity_fields'
	| 'create_entity_type'
	| 'add_entity_field'
	| 'get_entities'
	| 'create_entity'
	| 'update_entity'
	| 'get_help'
	| 'save_workflow'
	| 'list_workflows'
	| 'get_workflow'
	| 'create_table'
	| 'create_page'
	| 'update_app_spec';

export const tools: Tool[] = [
	...integrations.tools,
	...communication.tools,
	...documents.tools,
	...entities.tools,
	...help.tools,
	...workflows.tools
];

export async function dispatchTool(
	db: Db,
	name: ToolName,
	input: unknown,
	env?: import('./shared').ToolEnv,
	ctx?: ExecutionContext
) {
	switch (name) {
		case 'list_integrations':              return integrations.handleListIntegrations(db);
		case 'call_external_api':              return integrations.handleCallExternalApi(db, input);
		case 'build_handoff_data':             return documents.handleBuildHandoffData(input, env);
		case 'delete_read_notifications':      return communication.handleDeleteReadNotifications(db, input, env);
		case 'send_email':                     return communication.handleSendEmail(db, input, env);
		case 'send_notification':              return communication.handleSendNotification(db, input, env);
		case 'send_slack_notification':        return communication.handleSendSlackNotification(db, input, env);
		case 'list_entity_types':              return entities.handleListEntityTypes(db);
		case 'create_app':                     return entities.handleCreateApp(db, input);
		case 'get_entity_fields':              return entities.handleGetEntityFields(db, input);
		case 'create_entity_type':             return entities.handleCreateEntityType(db, input);
		case 'add_entity_field':               return entities.handleAddEntityField(db, input);
		case 'get_entities':                   return entities.handleGetEntities(db, input);
		case 'create_entity':                  return entities.handleCreateEntity(db, input);
		case 'update_entity':                  return entities.handleUpdateEntity(db, input);
		case 'get_help':                       return help.handleGetHelp(input);
		case 'save_workflow':                  return workflows.handleSaveWorkflow(db, input, env);
		case 'list_workflows':                 return workflows.handleListWorkflows(db, env);
		case 'get_workflow':                   return workflows.handleGetWorkflow(db, input, env);
		case 'create_table':                   return entities.handleCreateTable(db, input);
		case 'create_page':                    return entities.handleCreatePage(db, input);
		case 'update_app_spec':                return entities.handleUpdateAppSpec(db, input);
		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}
