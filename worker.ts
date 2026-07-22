// Custom Worker entry point (wrangler.toml `main`).
//
// Wraps the SvelteKit-generated worker (built to .svelte-kit/cloudflare/_worker.js via
// wrangler.build.jsonc, see svelte.config.js) and adds a `scheduled` handler for the
// workflow schedule-trigger Cron Trigger. Kept outside src/ so svelte-check doesn't try to
// type-check the generated bundle that doesn't exist until `vite build` runs.
//
// `fetch` is wrapped by an OAuthProvider (@cloudflare/workers-oauth-provider) so that
// `/api/apps/<id>/mcp` can be reached either via the legacy static Bearer token (unchanged,
// still handled by the SvelteKit route) or via a proper OAuth 2.1 access token. Requests that
// the OAuthProvider doesn't recognize as a valid OAuth API call (including the OAuth protocol's
// own /oauth/token, /oauth/register, and everything else in the app) fall straight through to
// the SvelteKit worker unchanged. See src/lib/server/mcp/oauth-config.ts for the routing design.
//
// The shape below (apiRoute/apiHandler/defaultHandler/*Endpoint options, the OAUTH_KV binding
// name, and the defaultHandler-fallback-on-invalid-token behavior) is the library's own contract,
// not something Boann invented: https://github.com/cloudflare/workers-oauth-provider
// (see its README and dist/oauth-provider.d.ts, both in node_modules, for the authoritative
// option list). The *values* passed in (routes, scope name, TTL) are Boann's own choices.
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { createDb } from './src/lib/server/db';
import { processDueWorkflows } from './src/lib/server/workflow/run';
import { processImportJob } from './src/lib/server/imports/consumer';
import { dispatchWorkflowEvents } from './src/lib/server/workflow/event-trigger';
import type { ImportJobMessage } from './src/lib/server/imports/types';
import type { WorkflowEventMessage } from './src/lib/server/workflow/event-trigger';
import { handleMcpOAuthApiRequest } from './src/lib/server/mcp/oauth-api-handler';
import { OAUTH_ROUTES, MCP_API_ROUTE_PREFIX, MCP_TOOL_SCOPE } from './src/lib/server/mcp/oauth-config';
import sveltekitWorker from './.svelte-kit/cloudflare/_worker.js';

const defaultHandler = { fetch: sveltekitWorker.fetch };

const oauthProvider = new OAuthProvider({
	apiRoute: MCP_API_ROUTE_PREFIX,
	apiHandler: {
		fetch: (request, env, ctx) => handleMcpOAuthApiRequest(request, env, ctx, defaultHandler.fetch)
	},
	defaultHandler,
	authorizeEndpoint: OAUTH_ROUTES.authorize,
	tokenEndpoint: OAUTH_ROUTES.token,
	clientRegistrationEndpoint: OAUTH_ROUTES.register,
	scopesSupported: [MCP_TOOL_SCOPE],
	accessTokenTTL: 3600
});

export default {
	fetch: (request, env, ctx) => oauthProvider.fetch(request, env, ctx),
	async scheduled(_controller, env, ctx) {
		const db = createDb(env.DB);
		ctx.waitUntil(processDueWorkflows(db, env));
	},
	// boann-imports キュー: アプリ生成ジョブおよびワークフローイベントを非同期処理する。
	// 失敗は各 handler 内で握って通知するため、メッセージは原則 ack（リトライしない）。
	async queue(batch, env, _ctx) {
		const db = createDb(env.DB);
		for (const message of batch.messages) {
			const body = message.body as ImportJobMessage | WorkflowEventMessage;
			if (body.type === 'workflow-event') {
				await dispatchWorkflowEvents(db, body.entityTypeId, body.event, body.recordId, body.data, env);
			} else {
				await processImportJob(db, env, body);
			}
			message.ack();
		}
	}
};
