import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { Db } from '../db';
import * as integrations from './integrations';
import * as search from './search';
import * as customers from './customers';
import * as contacts from './contacts';
import * as deals from './deals';
import * as activities from './activities';
import * as communication from './communication';
import * as documents from './documents';
import * as entities from './entities';
import * as approvals from './approvals';
import * as help from './help';
import * as followup from './followup';
import * as workflows from './workflows';

export type { ToolEnv } from './shared';

export type ToolName =
	| 'list_integrations'
	| 'call_external_api'
	| 'search_customers'
	| 'search_deals'
	| 'search_activities'
	| 'summarize_deals'
	| 'summarize_customers'
	| 'summarize_activities'
	| 'get_customer_detail'
	| 'get_customer_health_score'
	| 'get_customer_health_ranking'
	| 'get_customer_handover_summary'
	| 'build_handoff_data'
	| 'create_word_document'
	| 'create_excel_workbook'
	| 'create_powerpoint_presentation'
	| 'get_customers'
	| 'get_customer'
	| 'create_customer'
	| 'update_customer'
	| 'delete_customer'
	| 'create_customer_with_contact'
	| 'get_contacts'
	| 'create_contact'
	| 'update_contact'
	| 'get_deals'
	| 'create_deal'
	| 'update_deal'
	| 'get_activities'
	| 'create_activity'
	| 'delete_sent_reminders'
	| 'delete_read_notifications'
	| 'list_reminders'
	| 'send_email'
	| 'send_notification'
	| 'send_slack_notification'
	| 'create_reminder'
	| 'create_reminders_bulk'
	| 'list_entity_types'
	| 'create_app'
	| 'get_entity_fields'
	| 'create_entity_type'
	| 'add_entity_field'
	| 'get_entities'
	| 'create_entity'
	| 'update_entity'
	| 'list_approvals'
	| 'get_approval'
	| 'create_approval'
	| 'update_approval_step'
	| 'cancel_approval'
	| 'get_help'
	| 'suggest_customer_followup'
	| 'save_workflow'
	| 'list_workflows'
	| 'get_workflow';

export const tools: Tool[] = [
	...integrations.tools,
	...search.tools,
	...customers.tools,
	...contacts.tools,
	...deals.tools,
	...activities.tools,
	...communication.tools,
	...documents.tools,
	...entities.tools,
	...approvals.tools,
	...help.tools,
	...followup.tools,
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
		case 'search_customers':               return search.handleSearchCustomers(db, input);
		case 'search_deals':                   return search.handleSearchDeals(db, input);
		case 'search_activities':              return search.handleSearchActivities(db, input);
		case 'summarize_deals':                return search.handleSummarizeDeals(db, input);
		case 'summarize_customers':            return search.handleSummarizeCustomers(db, input);
		case 'summarize_activities':           return search.handleSummarizeActivities(db, input);
		case 'get_customer_detail':            return customers.handleGetCustomerDetail(db, input);
		case 'get_customer_health_score':      return customers.handleGetCustomerHealthScore(db, input, env);
		case 'get_customer_health_ranking':    return customers.handleGetCustomerHealthRanking(db, input);
		case 'get_customer_handover_summary':  return customers.handleGetCustomerHandoverSummary(db, input, env);
		case 'build_handoff_data':             return documents.handleBuildHandoffData(input, env);
		case 'create_word_document':           return documents.handleCreateWordDocument(db, input, env, ctx);
		case 'create_excel_workbook':          return documents.handleCreateExcelWorkbook(db, input, env, ctx);
		case 'create_powerpoint_presentation': return documents.handleCreatePowerpointPresentation(db, input, env, ctx);
		case 'get_customers':                  return customers.handleGetCustomers(db, input);
		case 'get_customer':                   return customers.handleGetCustomer(db, input);
		case 'create_customer':                return customers.handleCreateCustomer(db, input);
		case 'update_customer':                return customers.handleUpdateCustomer(db, input);
		case 'delete_customer':                return customers.handleDeleteCustomer(db, input);
		case 'create_customer_with_contact':   return customers.handleCreateCustomerWithContact(db, input);
		case 'get_contacts':                   return contacts.handleGetContacts(db, input);
		case 'create_contact':                 return contacts.handleCreateContact(db, input);
		case 'update_contact':                 return contacts.handleUpdateContact(db, input);
		case 'get_deals':                      return deals.handleGetDeals(db, input);
		case 'create_deal':                    return deals.handleCreateDeal(db, input, env);
		case 'update_deal':                    return deals.handleUpdateDeal(db, input);
		case 'get_activities':                 return activities.handleGetActivities(db, input);
		case 'create_activity':                return activities.handleCreateActivity(db, input, env);
		case 'delete_sent_reminders':          return communication.handleDeleteSentReminders(db, input, env);
		case 'delete_read_notifications':      return communication.handleDeleteReadNotifications(db, input, env);
		case 'list_reminders':                 return communication.handleListReminders(db, input, env);
		case 'send_email':                     return communication.handleSendEmail(db, input, env);
		case 'send_notification':              return communication.handleSendNotification(db, input, env);
		case 'send_slack_notification':        return communication.handleSendSlackNotification(db, input, env);
		case 'create_reminder':                return communication.handleCreateReminder(db, input, env);
		case 'create_reminders_bulk':          return communication.handleCreateRemindersBulk(db, input, env);
		case 'list_entity_types':              return entities.handleListEntityTypes(db);
		case 'create_app':                     return entities.handleCreateApp(db, input);
		case 'get_entity_fields':              return entities.handleGetEntityFields(db, input);
		case 'create_entity_type':             return entities.handleCreateEntityType(db, input);
		case 'add_entity_field':               return entities.handleAddEntityField(db, input);
		case 'get_entities':                   return entities.handleGetEntities(db, input);
		case 'create_entity':                  return entities.handleCreateEntity(db, input);
		case 'update_entity':                  return entities.handleUpdateEntity(db, input);
		case 'list_approvals':                 return approvals.handleListApprovals(db, input);
		case 'get_approval':                   return approvals.handleGetApproval(db, input);
		case 'create_approval':                return approvals.handleCreateApproval(db, input, env);
		case 'update_approval_step':           return approvals.handleUpdateApprovalStep(db, input, env);
		case 'cancel_approval':                return approvals.handleCancelApproval(db, input);
		case 'get_help':                       return help.handleGetHelp(input);
		case 'suggest_customer_followup':      return followup.handleSuggestCustomerFollowup(db, input, env);
		case 'save_workflow':                  return workflows.handleSaveWorkflow(db, input, env);
		case 'list_workflows':                 return workflows.handleListWorkflows(db, env);
		case 'get_workflow':                   return workflows.handleGetWorkflow(db, input, env);
		default:
			throw new Error(`Unknown tool: ${name}`);
	}
}
