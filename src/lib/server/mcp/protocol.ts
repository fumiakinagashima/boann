import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { Db } from '../db';
import { RpcErrorCode, rpcError, rpcResult, type JsonRpcId } from './jsonrpc';
import { listAppMcpTools, callAppMcpTool } from './tools';
import type { ToolEnv } from '../tools/shared';
import { RECORD_VIEW_URI, RECORD_VIEW_HTML } from './ui-resources';

// MCP(Model Context Protocol)のbase protocol実装。ここのメソッド名(initialize/tools/list等)・
// レスポンス形・通知(id無し)の扱いは仕様がそのまま決めているもので、Boann独自の設計ではない。
// 仕様: https://modelcontextprotocol.io/specification/2025-06-18
// (SUPPORTED_PROTOCOL_VERSIONSの並び=クライアントが指定したバージョンが未対応ならこちらの最新に
// フォールバックする、というネゴシエーション方式も仕様の"Version Negotiation"節で定義されている挙動)
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
		// method名・params/result形はMCP仕様の各節が規定するもの(下記URLはBoannが対応している
		// メソッドの一次情報。initialize/ping: basic/lifecycle、tools/*: server/tools、
		// resources/read: server/resources)。listAppMcpTools/callAppMcpTool/handleResourcesRead
		// の中身(どのツールを生成するか等)はBoann独自の設計。
		// https://modelcontextprotocol.io/specification/2025-06-18
		let result: unknown;
		switch (method) {
			case 'initialize':
				result = handleInitialize(params);
				break;
			case 'notifications/initialized':
				// 通知(id無し)への応答は仕様上「本文なしの202」。ここもBoannの選択ではなく
				// MCPのStreamable HTTP transport節が定めている挙動。
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

/**
 * 認証済みのMCPリクエスト(HTTP)をJSON-RPCとして処理してResponseを返す。認証方式(静的Bearer/OAuth)
 * を問わず共通の後処理として、SvelteKitの`/api/apps/[id]/mcp`ルートと、workers-oauth-providerの
 * apiHandler(worker.ts)の両方から呼ばれる。
 */
export async function handleMcpHttpRequest(db: Db, appId: string, request: Request, env?: ToolEnv): Promise<Response> {
	let body: unknown;
	try {
		body = JSON.parse(await request.text());
	} catch {
		return json(rpcError(null, RpcErrorCode.ParseError, 'Parse error'), { status: 200 });
	}

	const { httpStatus, body: resBody } = await handleMcpMessage(db, appId, body, env);
	return resBody === null ? new Response(null, { status: httpStatus }) : json(resBody, { status: httpStatus });
}
