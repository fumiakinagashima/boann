import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { errors } from '$lib/server/errors';
import { verifyAppMcpToken } from '$lib/server/mcp/auth';
import { handleMcpHttpRequest } from '$lib/server/mcp/protocol';

function unauthorized(): Response {
	return new Response(JSON.stringify({ error: 'Unauthorized' }), {
		status: 401,
		headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="boann-mcp"' }
	});
}

// Authentication with the static Bearer token happens here. Requests arriving with an OAuth
// access token are handled by the apiHandler on the worker.ts (OAuthProvider) side before
// reaching this route (they only fall through to here via defaultHandler when there is no
// valid OAuth token). See the comment in `mcp/oauth-config.ts` for details.
export const POST: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('Not available');
	const db = createDb(platform.env.DB);

	const auth = await verifyAppMcpToken(db, params.id, request.headers.get('Authorization'));
	if (!auth.ok) return unauthorized();

	return handleMcpHttpRequest(db, params.id, request, platform.env);
};
