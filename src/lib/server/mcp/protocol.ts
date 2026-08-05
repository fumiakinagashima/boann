import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { Db } from '../db';
import { RpcErrorCode, rpcError, rpcResult, type JsonRpcId } from './jsonrpc';
import { listAppMcpTools, callAppMcpTool } from './tools';
import type { ToolEnv } from '../tools/shared';
import { RECORD_VIEW_URI, RECORD_VIEW_HTML } from './ui-resources';

// MCP(Model Context Protocol)のbase protocol実装。ここのメソッド名(initialize/tools/list等)・
// レスポンス形・通知(id無し)の扱いは仕様がそのまま決めているもので、Boann独自の設計ではない。
// 仕様: https://modelcontextprotocol.io/specification/2026-07-28 (2026-08-05、2026-07-28正式版に追従)
//
// 2026-07-28版で、`initialize`/`notifications/initialized`ハンドシェイクでセッションを張る旧世代
// ("legacy"、2025-11-25以前)と、各リクエストの`params._meta`にprotocolVersion等を載せてステートレスに
// 処理する新世代("modern"、2026-07-28〜)に分岐した(仕様: /specification/2026-07-28/basic/versioning#terminology)。
// Claude Desktop等、既存クライアントがどちらのeraで話してくるか不明なため、1つのエンドポイントで両方を
// 提供するdual-era serverとして実装する(仕様が明示的に許容・推奨するパターン:
// /specification/2026-07-28/basic/versioning#backward-compatibility-with-initialization-based-versions
// 「A server that wishes to support both legacy clients...and modern clients...MAY implement both behaviors」)。
// era判定(Boann独自の実装選択、仕様は判定方法自体を規定しない): リクエストの
// `params._meta['io.modelcontextprotocol/protocolVersion']`が存在すればmodern、
// 存在しなければ既存のlegacy処理(initializeハンドシェイク前提)のまま。

/** legacyの`initialize`ハンドシェイクで返す/受け付けるプロトコルバージョン(2025-11-25以前)。 */
export const LEGACY_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
/** modernの各リクエスト`_meta`で受け付けるプロトコルバージョン(2026-07-28〜)。 */
export const MODERN_PROTOCOL_VERSIONS = ['2026-07-28'];
const SERVER_INFO = { name: 'boann', version: '0.1.0' };
const CAPABILITIES = { tools: {}, resources: {} };

// _metaの予約キー名。仕様: /specification/2026-07-28/basic/index#meta
const META_PROTOCOL_VERSION = 'io.modelcontextprotocol/protocolVersion';
const META_CLIENT_CAPABILITIES = 'io.modelcontextprotocol/clientCapabilities';
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo';

// MCP仕様が予約するエラーコード領域(-32020〜-32099)に属する、2026-07-28版で新設されたコード。
// JSON-RPC自体が定義する汎用コード(jsonrpc.tsのRpcErrorCode)とは別物。
// 仕様: /specification/2026-07-28/basic/index#error-codes
const McpErrorCode = {
	HeaderMismatch: -32020,
	UnsupportedProtocolVersion: -32022
} as const;

const jsonRpcMessageSchema = z.object({
	jsonrpc: z.literal('2.0'),
	id: z.union([z.string(), z.number(), z.null()]).optional(),
	method: z.string(),
	params: z.unknown().optional()
});

export type McpResponse = { httpStatus: number; body: unknown | null };

/**
 * Streamable HTTPがJSON-RPC bodyと一致することを要求する標準ヘッダー(2026-07-28で新設)。
 * 仕様: /specification/2026-07-28/basic/transports/streamable-http#request-metadata
 * HTTP層を経由しない呼び出し(vitest等)では省略可——その場合はヘッダー側の照合はスキップする
 * (body/`_meta`側の検証は行う)。
 */
export type McpHttpHeaders = {
	protocolVersion: string | null;
	method: string | null;
	name: string | null;
};

function handleInitialize(params: unknown) {
	const p = params as { protocolVersion?: string } | undefined;
	const protocolVersion =
		p?.protocolVersion && LEGACY_PROTOCOL_VERSIONS.includes(p.protocolVersion)
			? p.protocolVersion
			: LEGACY_PROTOCOL_VERSIONS[0];
	return { protocolVersion, capabilities: CAPABILITIES, serverInfo: SERVER_INFO };
}

/**
 * server/discover: モダン版で新設された、ハンドシェイク無しでサーバーの対応バージョン・
 * capabilities・identityを返すRPC。仕様上SERVER MUST実装。
 * 仕様: /specification/2026-07-28/server/discover
 */
function handleDiscover() {
	return {
		supportedVersions: MODERN_PROTOCOL_VERSIONS,
		capabilities: CAPABILITIES,
		instructions: 'このサーバーが公開するテーブルCRUD・ワークフロー実行ツールで、アプリのデータ操作を行えます。'
	};
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

function getMeta(params: unknown): Record<string, unknown> | undefined {
	if (!params || typeof params !== 'object') return undefined;
	const m = (params as { _meta?: unknown })._meta;
	return m && typeof m === 'object' ? (m as Record<string, unknown>) : undefined;
}

/** Mcp-Nameヘッダーとの照合対象(tools/callはname、resources/readはuri)。仕様の表(Standard Request Headers)参照。 */
function getRequestTargetName(method: string, params: unknown): string | undefined {
	const p = params as { name?: string; uri?: string } | undefined;
	if (method === 'tools/call') return p?.name;
	if (method === 'resources/read') return p?.uri;
	return undefined;
}

// tools/list・resources/readはCacheableResult(ttlMs/cacheScope)が必須化された(2026-07-28)。
// 仕様: /specification/2026-07-28/changelog (Minor changes #5)。他のメソッド(tools/call等)は対象外。
// tools/listはappIdごとに異なる(private=トークンの権限内でのみ有効)、resources/readは
// 全アプリ共通の静的HTMLテンプレートなのでpublicかつ長めのttlで良い。
const CACHEABLE_HINTS: Partial<Record<string, { ttlMs: number; cacheScope: 'public' | 'private' }>> = {
	'tools/list': { ttlMs: 60_000, cacheScope: 'private' },
	'resources/read': { ttlMs: 86_400_000, cacheScope: 'public' }
};

/** 1件のJSON-RPCメッセージを処理する。SvelteKit非依存の純関数（vitestからも直接呼べる）。 */
export async function handleMcpMessage(
	db: Db,
	appId: string,
	msg: unknown,
	env?: ToolEnv,
	headers?: McpHttpHeaders
): Promise<McpResponse> {
	const parsed = jsonRpcMessageSchema.safeParse(msg);
	if (!parsed.success) {
		return { httpStatus: 200, body: rpcError(null, RpcErrorCode.InvalidRequest, 'Invalid JSON-RPC request') };
	}

	const { id, method, params } = parsed.data;
	const rpcId: JsonRpcId = id ?? null;
	const isNotification = id === undefined;
	const meta = getMeta(params);
	const requestedProtocolVersion =
		typeof meta?.[META_PROTOCOL_VERSION] === 'string' ? (meta[META_PROTOCOL_VERSION] as string) : undefined;
	// modern era判定。上記コメント参照——判定基準自体はBoann独自の実装選択。
	const isModern = requestedProtocolVersion !== undefined;

	function respond(httpStatus: number, code: number, message: string, data?: unknown): McpResponse {
		if (isNotification) return { httpStatus: 202, body: null };
		return { httpStatus, body: rpcError(rpcId, code, message, data) };
	}

	if (isModern) {
		// per-request _meta必須フィールドの検証。仕様: /specification/2026-07-28/basic/index#meta
		// 「A request missing any required field is malformed; the server MUST reject it with
		// JSON-RPC error code -32602 (Invalid params). On HTTP, the response status MUST be 400.」
		const clientCapabilities = meta?.[META_CLIENT_CAPABILITIES];
		if (!clientCapabilities || typeof clientCapabilities !== 'object') {
			return respond(400, RpcErrorCode.InvalidParams, `${META_CLIENT_CAPABILITIES} is required`);
		}
		if (!MODERN_PROTOCOL_VERSIONS.includes(requestedProtocolVersion!)) {
			// 仕様: /specification/2026-07-28/basic/versioning#protocol-version-negotiation
			return respond(400, McpErrorCode.UnsupportedProtocolVersion, 'Unsupported protocol version', {
				supported: MODERN_PROTOCOL_VERSIONS,
				requested: requestedProtocolVersion
			});
		}
		// HTTP層のヘッダー⇔body照合。仕様: .../streamable-http#server-validation
		// (ヘッダー情報が渡されない直接呼び出し(vitest等)ではスキップ——HTTP固有の要件のため)
		if (headers) {
			if (headers.protocolVersion !== requestedProtocolVersion) {
				return respond(
					400,
					McpErrorCode.HeaderMismatch,
					`Header mismatch: MCP-Protocol-Version header '${headers.protocolVersion}' does not match body value '${requestedProtocolVersion}'`
				);
			}
			if (headers.method !== method) {
				return respond(
					400,
					McpErrorCode.HeaderMismatch,
					`Header mismatch: Mcp-Method header '${headers.method}' does not match body value '${method}'`
				);
			}
			const expectedName = getRequestTargetName(method, params);
			if (expectedName !== undefined && headers.name !== expectedName) {
				return respond(
					400,
					McpErrorCode.HeaderMismatch,
					`Header mismatch: Mcp-Name header '${headers.name}' does not match body value '${expectedName}'`
				);
			}
		}
	}

	try {
		// method名・params/result形はMCP仕様の各節が規定するもの(下記URLはBoannが対応している
		// メソッドの一次情報。versioning: basic/versioning、tools/*: server/tools、
		// resources/read: server/resources)。listAppMcpTools/callAppMcpTool/handleResourcesRead
		// の中身(どのツールを生成するか等)はBoann独自の設計。
		// https://modelcontextprotocol.io/specification/2026-07-28
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
			case 'server/discover':
				result = handleDiscover();
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
				// modern era: 未実装メソッドは404(仕様: streamable-http#protocol-version-header)。
				// legacy era: 従来通り200+JSON-RPCエラー本文(2025-06-18以前の挙動を変えない)。
				return isModern
					? respond(404, RpcErrorCode.MethodNotFound, `Unknown method: ${method}`)
					: { httpStatus: 200, body: rpcError(rpcId, RpcErrorCode.MethodNotFound, `Unknown method: ${method}`) };
		}

		if (isModern && result && typeof result === 'object' && !Array.isArray(result)) {
			// resultTypeは2026-07-28で全レスポンス必須化。仕様: /specification/2026-07-28/basic/index#resultresponses
			// serverInfoはSHOULD("without relying on any prior connection state"、statelessなmodernでは
			// initializeでのserverInfo通知ができない代替)。仕様: basic/index#meta (Per-response protocol fields)
			const hint = method in CACHEABLE_HINTS ? CACHEABLE_HINTS[method] : undefined;
			result = {
				...(result as Record<string, unknown>),
				resultType: 'complete',
				...(hint ?? {}),
				_meta: { ...((result as { _meta?: unknown })._meta as object | undefined), [META_SERVER_INFO]: SERVER_INFO }
			};
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

	// modern era(2026-07-28)のStandard Request Headers。仕様:
	// /specification/2026-07-28/basic/transports/streamable-http#standard-request-headers
	const headers: McpHttpHeaders = {
		protocolVersion: request.headers.get('MCP-Protocol-Version'),
		method: request.headers.get('Mcp-Method'),
		name: request.headers.get('Mcp-Name')
	};

	const { httpStatus, body: resBody } = await handleMcpMessage(db, appId, body, env, headers);
	return resBody === null ? new Response(null, { status: httpStatus }) : json(resBody, { status: httpStatus });
}
