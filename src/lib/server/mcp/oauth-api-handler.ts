import { createDb } from '../db';
import { handleMcpHttpRequest } from './protocol';
import { matchMcpEndpointPath, type McpGrantProps } from './oauth-config';

type RawHandler = (request: Request, env: any, ctx: any) => Response | Promise<Response>;

function forbidden(message: string): Response {
	return new Response(JSON.stringify({ error: message }), {
		status: 403,
		headers: { 'Content-Type': 'application/json' }
	});
}

/**
 * The apiHandler for workers-oauth-provider. `apiRoute` (`/api/apps/`) only supports prefix
 * matching and cannot express an exact match that includes an app ID, so here we determine
 * whether the path is exactly `/api/apps/<id>/mcp`, and if it doesn't match, pass the request
 * through unchanged to the existing SvelteKit worker (defaultHandler).
 * This means that even if a request carrying an OAuth token is mistakenly routed to another
 * `/api/apps/**` endpoint, it's still handled by the usual session-cookie authentication.
 *
 * This function's signature (request, env, ctx) and the meaning of ctx.props are the contract
 * defined by @cloudflare/workers-oauth-provider (the apiHandler option), not part of the MCP
 * or OAuth specs themselves.
 * https://github.com/cloudflare/workers-oauth-provider (see the README's "apiHandler" section
 * and the JSDoc on `OAuthProviderOptions.apiHandler` in `dist/oauth-provider.d.ts`).
 * The contents of props (accountId/appId) are Boann-specific (populated by the caller of
 * completeAuthorization in `/oauth/authorize` = `src/routes/oauth/authorize/+page.server.ts`).
 */
export async function handleMcpOAuthApiRequest(
	request: Request,
	env: any,
	ctx: { props?: McpGrantProps },
	fallback: RawHandler
): Promise<Response> {
	const url = new URL(request.url);
	const appId = request.method === 'POST' ? matchMcpEndpointPath(url.pathname) : null;
	if (!appId) return fallback(request, env, ctx);

	// OAuthProvider has already validated the token's validity (signature, revocation,
	// resource/audience), but we still explicitly re-check per-app tenant isolation here
	// too (the same defense-in-depth policy as the existing assertOwnedByTable, etc).
	if (!ctx.props || ctx.props.appId !== appId) return forbidden('Unknown tool: this token is not authorized for this app');

	const db = createDb(env.DB);
	return handleMcpHttpRequest(db, appId, request, env);
}
