// Configuration for the OAuth 2.1 authorization server (@cloudflare/workers-oauth-provider) side.
// A framework-agnostic home for pure config/helpers, referenced from both worker.ts
// (where OAuthProvider is constructed) and the SvelteKit /oauth/authorize route.
//
// References:
// - OAuth 2.1: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13
// - RFC 8707 (Resource Indicators for OAuth 2.0): https://www.rfc-editor.org/rfc/rfc8707
// - MCP Authorization: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
// - @cloudflare/workers-oauth-provider: https://github.com/cloudflare/workers-oauth-provider
//   (the README and oauth-provider.d.ts are the primary sources for options/OAuthHelpers;
//   the actual file lives in node_modules)
//
// The path names authorize/token/register themselves are not fixed by the spec (Boann is
// free to choose the values passed to OAuthProvider's authorizeEndpoint/tokenEndpoint/
// clientRegistrationEndpoint). What IS fixed is the "behavior" each endpoint must implement
// (RFC 6749/7591/8414).

// Made to coexist with the static Bearer token (mcp/auth.ts). Rather than branching on what
// the token looks like, any request OAuthProvider judges to not be a valid OAuth token
// automatically flows through to defaultHandler (= the existing SvelteKit worker), so the
// legacy Bearer validation (+server.ts) keeps working unmodified.
// (This "silently fall through to defaultHandler when invalid" behavior is a property of the
// workers-oauth-provider library, not of the OAuth spec itself. Grounded in the library's
// d.ts comment: "Handler for all non-API requests or API requests without a valid token".)
export const OAUTH_ROUTES = {
	authorize: '/oauth/authorize',
	token: '/oauth/token',
	register: '/oauth/register'
} as const;

// apiRoute only supports prefix matching (it can't express an exact match for a path with an
// app ID in the middle), so we deliberately set it broadly and have the apiHandler side
// delegate anything other than "/api/apps/<id>/mcp" to the existing SvelteKit worker.
// This works around a constraint of workers-oauth-provider's apiRoute option (prefix-only
// support) and is a Boann-side design decision unrelated to the OAuth or MCP specs.
export const MCP_API_ROUTE_PREFIX = '/api/apps/';

// The value of the scope string itself is up to Boann (the OAuth spec only mandates that
// scope be a space-delimited string; the vocabulary of values is left to the server
// implementer). Since ACL isn't implemented yet, this single scope covers all tools at once.
export const MCP_TOOL_SCOPE = 'mcp';

const MCP_ENDPOINT_PATH_RE = /^\/api\/apps\/([^/]+)\/mcp$/;

export function matchMcpEndpointPath(pathname: string): string | null {
	return MCP_ENDPOINT_PATH_RE.exec(pathname)?.[1] ?? null;
}

/** App-specific info stored attached to an OAuth grant once the authorization code is issued. */
export type McpGrantProps = {
	accountId: string;
	appId: string;
};

/**
 * Extracts which app is being requested from the resource parameter sent by the MCP client
 * (RFC 8707, normally the canonical MCP endpoint URL). Returns null if resource is missing,
 * has multiple values, or doesn't match the expected path shape.
 */
export function parseMcpResourceAppId(resource: string | string[] | undefined): string | null {
	if (!resource || Array.isArray(resource)) return null;
	try {
		return matchMcpEndpointPath(new URL(resource).pathname);
	} catch {
		return null;
	}
}
