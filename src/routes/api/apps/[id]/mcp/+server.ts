import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { errors } from '$lib/server/errors';
import { verifyAppMcpToken } from '$lib/server/mcp/auth';
import { handleMcpMessage } from '$lib/server/mcp/protocol';
import { RpcErrorCode, rpcError } from '$lib/server/mcp/jsonrpc';

function unauthorized(): Response {
	return new Response(JSON.stringify({ error: 'Unauthorized' }), {
		status: 401,
		headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="boann-mcp"' }
	});
}

export const POST: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('利用できません');
	const db = createDb(platform.env.DB);

	const auth = await verifyAppMcpToken(db, params.id, request.headers.get('Authorization'));
	if (!auth.ok) return unauthorized();

	let body: unknown;
	try {
		body = JSON.parse(await request.text());
	} catch {
		return json(rpcError(null, RpcErrorCode.ParseError, 'Parse error'), { status: 200 });
	}

	const { httpStatus, body: resBody } = await handleMcpMessage(db, params.id, body, platform.env);
	return resBody === null ? new Response(null, { status: httpStatus }) : json(resBody, { status: httpStatus });
};
