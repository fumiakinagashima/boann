import { error, fail, redirect } from '@sveltejs/kit';
import type { AuthRequest } from '@cloudflare/workers-oauth-provider';
import type { Actions, PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getAppById } from '$lib/server/db/table-service';
import { canManageApp } from '$lib/server/authz';
import { parseMcpResourceAppId, MCP_TOOL_SCOPE, type McpGrantProps } from '$lib/server/mcp/oauth-config';

// This page itself is subject to hooks.server.ts's normal session guard (not included in PUBLIC_PATHS).
// If the user isn't logged in they're automatically redirected to /signin, so we can assume
// locals.account is always populated here.
//
// This entire file addresses the contract workers-oauth-provider requires — "the app implements
// the authorization UI itself" (the library only provides helpers: parseAuthRequest/lookupClient/
// completeAuthorization; it doesn't build the screen itself. See the README's "Usage" section).
// The "look, copy, and permission check (canManageApp)" of this screen is Boann's own design, but
// the structure of passing each AuthRequest value through via hidden fields, and what to call as a
// result of approve/deny (completeAuthorization / redirect), are the steps required by OAuth 2.1's
// authorization code flow
// (https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13#section-1.3.1).

// AuthRequest's field names (response_type/client_id/redirect_uri/scope/state) are exactly the
// authorization request parameters defined by RFC 6749 §4.1.1. code_challenge/code_challenge_method
// are PKCE (RFC 7636), and resource is RFC 8707 (see the comment in oauth-config.ts).
function authRequestFromForm(form: FormData): AuthRequest {
	return {
		responseType: String(form.get('response_type') ?? ''),
		clientId: String(form.get('client_id') ?? ''),
		redirectUri: String(form.get('redirect_uri') ?? ''),
		scope: String(form.get('scope') ?? '').split(' ').filter(Boolean),
		state: String(form.get('state') ?? ''),
		codeChallenge: form.get('code_challenge') ? String(form.get('code_challenge')) : undefined,
		codeChallengeMethod: form.get('code_challenge_method') ? String(form.get('code_challenge_method')) : undefined,
		resource: form.get('resource') ? String(form.get('resource')) : undefined
	};
}

async function resolveApp(platform: App.Platform | undefined, resource: string | string[] | undefined) {
	if (!platform?.env?.DB) throw error(503, 'Unavailable');
	const appId = parseMcpResourceAppId(resource);
	if (!appId) throw error(400, 'The resource parameter is invalid (cannot identify the target app)');
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, appId);
	if (!app) throw error(404, 'App not found');
	return { db, app };
}

export const load: PageServerLoad = async ({ request, platform, locals }) => {
	if (!platform?.env?.OAUTH_PROVIDER) throw error(503, 'Unavailable');

	let authReq: AuthRequest;
	try {
		authReq = await platform.env.OAUTH_PROVIDER.parseAuthRequest(request);
	} catch {
		throw error(400, 'Invalid authorization request');
	}

	const clientInfo = await platform.env.OAUTH_PROVIDER.lookupClient(authReq.clientId);
	if (!clientInfo) throw error(400, 'Unregistered client');

	const { app } = await resolveApp(platform, authReq.resource);
	if (!canManageApp(app, locals.account)) throw error(403, 'You do not have permission to manage this app');

	return {
		authReq,
		clientName: clientInfo.clientName || clientInfo.clientId,
		appLabel: app.label
	};
};

export const actions: Actions = {
	approve: async ({ request, platform, locals }) => {
		if (!platform?.env?.OAUTH_PROVIDER || !locals.account) throw error(401, 'Authentication required');

		const authReq = authRequestFromForm(await request.formData());
		const { app } = await resolveApp(platform, authReq.resource);
		if (!canManageApp(app, locals.account)) return fail(403, { message: 'You do not have permission' });

		const appId = parseMcpResourceAppId(authReq.resource) as string; // Already validated by resolveApp
		const scope = authReq.scope.length ? authReq.scope : [MCP_TOOL_SCOPE];
		const props: McpGrantProps = { accountId: locals.account.id, appId };

		const { redirectTo } = await platform.env.OAUTH_PROVIDER.completeAuthorization({
			request: authReq,
			userId: locals.account.id,
			metadata: { appId, appLabel: app.label },
			scope,
			props
		});
		throw redirect(303, redirectTo);
	},

	deny: async ({ request, platform }) => {
		if (!platform?.env?.OAUTH_PROVIDER) throw error(503, 'Unavailable');
		const form = await request.formData();
		const clientId = String(form.get('client_id') ?? '');
		const redirectUri = String(form.get('redirect_uri') ?? '');
		const state = String(form.get('state') ?? '');

		// Don't trust the hidden field's redirect target as-is; only allow one that's included in
		// the registered client's redirect_uris (open-redirect defense. This is Boann's own
		// defense — completeAuthorization() presumably does the same kind of validation internally
		// in the library, but the deny path doesn't go through the library, so we validate it
		// explicitly here).
		const clientInfo = await platform.env.OAUTH_PROVIDER.lookupClient(clientId);
		if (!clientInfo || !clientInfo.redirectUris.includes(redirectUri)) throw error(400, 'Invalid request');

		// The error=access_denied redirect is the authorization error response shape defined by RFC 6749 §4.1.2.1.
		// https://www.rfc-editor.org/rfc/rfc6749#section-4.1.2.1
		const url = new URL(redirectUri);
		url.searchParams.set('error', 'access_denied');
		if (state) url.searchParams.set('state', state);
		throw redirect(303, url.toString());
	}
};
