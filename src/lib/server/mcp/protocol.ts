import { z } from 'zod';
import type { Db } from '../db';
import { RpcErrorCode, rpcError, rpcResult, type JsonRpcId } from './jsonrpc';
import { listAppMcpTools, callAppMcpTool } from './tools';
import type { ToolEnv } from '../tools/shared';
import { RECORD_VIEW_URI, RECORD_VIEW_HTML } from './ui-resources';

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'boann', version: '0.1.0' };

const jsonRpcMessageSchema = z.object({
	jsonrpc: z.literal('2.0'),
	id: z.union([z.string(), z.number(), z.null()]).optional(),
	method: z.string(),
	params: z.unknown().optional()
});

export type McpResponse = { httpStatus: number; body: unknown | null };

function handleInitialize(params: unknown) {
	const p = params as { protocolVersion?: string } | undefined;
	const protocolVersion =
		p?.protocolVersion && SUPPORTED_PROTOCOL_VERSIONS.includes(p.protocolVersion)
			? p.protocolVersion
			: SUPPORTED_PROTOCOL_VERSIONS[0];
	return { protocolVersion, capabilities: { tools: {}, resources: {} }, serverInfo: SERVER_INFO };
}

async function handleToolsCall(db: Db, appId: string, params: unknown, env?: ToolEnv) {
	const p = params as { name?: string; arguments?: unknown } | undefined;
	if (!p?.name) return { content: [{ type: 'text' as const, text: 'tool name is required' }], isError: true as const };
	return callAppMcpTool(db, appId, p.name, p.arguments ?? {}, env);
}

function handleResourcesRead(params: unknown) {
	const p = params as { uri?: string } | undefined;
	if (p?.uri === RECORD_VIEW_URI) {
		return { contents: [{ uri: RECORD_VIEW_URI, mimeType: 'text/html;profile=mcp-app', text: RECORD_VIEW_HTML }] };
	}
	throw new Error(`Unknown resource: ${p?.uri ?? ''}`);
}

/** 1件のJSON-RPCメッセージを処理する。SvelteKit非依存の純関数（vitestからも直接呼べる）。 */
export async function handleMcpMessage(db: Db, appId: string, msg: unknown, env?: ToolEnv): Promise<McpResponse> {
	const parsed = jsonRpcMessageSchema.safeParse(msg);
	if (!parsed.success) {
		return { httpStatus: 200, body: rpcError(null, RpcErrorCode.InvalidRequest, 'Invalid JSON-RPC request') };
	}

	const { id, method, params } = parsed.data;
	const rpcId: JsonRpcId = id ?? null;
	const isNotification = id === undefined;

	try {
		let result: unknown;
		switch (method) {
			case 'initialize':
				result = handleInitialize(params);
				break;
			case 'notifications/initialized':
				return { httpStatus: 202, body: null };
			case 'ping':
				result = {};
				break;
			case 'tools/list':
				result = { tools: await listAppMcpTools(db, appId) };
				break;
			case 'tools/call':
				result = await handleToolsCall(db, appId, params, env);
				break;
			case 'resources/read':
				result = handleResourcesRead(params);
				break;
			default:
				if (isNotification) return { httpStatus: 202, body: null };
				return { httpStatus: 200, body: rpcError(rpcId, RpcErrorCode.MethodNotFound, `Unknown method: ${method}`) };
		}
		if (isNotification) return { httpStatus: 202, body: null };
		return { httpStatus: 200, body: rpcResult(rpcId, result) };
	} catch (e) {
		if (isNotification) return { httpStatus: 202, body: null };
		return {
			httpStatus: 200,
			body: rpcError(rpcId, RpcErrorCode.InternalError, e instanceof Error ? e.message : String(e))
		};
	}
}
