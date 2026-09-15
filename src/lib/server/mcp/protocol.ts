import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { Db } from '../db';
import { RpcErrorCode, rpcError, rpcResult, type JsonRpcId } from './jsonrpc';
import { listAppMcpTools, callAppMcpTool } from './tools';
import type { ToolEnv } from '../tools/shared';
import { RECORD_VIEW_URI, RECORD_VIEW_HTML } from './ui-resources';

// Base protocol implementation of MCP (Model Context Protocol). The method names here
// (initialize/tools/list etc.), response shapes, and notification (no id) handling are
// dictated entirely by the spec — this is not Boann's own design.
// Spec: https://modelcontextprotocol.io/specification/2026-07-28 (2026-08-05, tracking the 2026-07-28 final release)
//
// The 2026-07-28 spec splits behavior into an older generation ("legacy", 2025-11-25 and
// earlier) that establishes a session via the `initialize`/`notifications/initialized`
// handshake, and a newer generation ("modern", 2026-07-28 onward) that carries protocolVersion
// etc. in each request's `params._meta` and is processed statelessly
// (spec: /specification/2026-07-28/basic/versioning#terminology). Since we don't know which
// era an existing client (e.g. Claude Desktop) will speak, this is implemented as a
// dual-era server that serves both from a single endpoint — a pattern the spec explicitly
// permits and recommends:
// /specification/2026-07-28/basic/versioning#backward-compatibility-with-initialization-based-versions
// ("A server that wishes to support both legacy clients...and modern clients...MAY implement
// both behaviors").
// Era detection (Boann's own implementation choice — the spec itself does not mandate how
// this is determined): if the request's `params._meta['io.modelcontextprotocol/protocolVersion']`
// is present, treat it as modern; otherwise fall back to the existing legacy handling
// (which assumes the initialize handshake).

/** Protocol versions accepted/returned by the legacy `initialize` handshake (2025-11-25 and earlier). */
export const LEGACY_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
/** Protocol versions accepted in each modern request's `_meta` (2026-07-28 onward). */
export const MODERN_PROTOCOL_VERSIONS = ['2026-07-28'];
const SERVER_INFO = { name: 'boann', version: '0.1.0' };
const CAPABILITIES = { tools: {}, resources: {} };

// Reserved _meta key names. Spec: /specification/2026-07-28/basic/index#meta
const META_PROTOCOL_VERSION = 'io.modelcontextprotocol/protocolVersion';
const META_CLIENT_CAPABILITIES = 'io.modelcontextprotocol/clientCapabilities';
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo';

// Codes newly introduced in the 2026-07-28 spec, within the error code range the MCP spec
// reserves (-32020 to -32099). Distinct from the generic codes JSON-RPC itself defines
// (RpcErrorCode in jsonrpc.ts).
// Spec: /specification/2026-07-28/basic/index#error-codes
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
 * Standard header that Streamable HTTP requires to match the JSON-RPC body (newly
 * introduced in 2026-07-28).
 * Spec: /specification/2026-07-28/basic/transports/streamable-http#request-metadata
 * Can be omitted for calls that don't go through the HTTP layer (e.g. vitest) — in that
 * case header-side matching is skipped (body/`_meta`-side validation still runs).
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
 * server/discover: an RPC newly introduced in the modern generation that returns the
 * server's supported versions, capabilities, and identity without a handshake. The spec
 * says the SERVER MUST implement it.
 * Spec: /specification/2026-07-28/server/discover
 */
function handleDiscover() {
	return {
		supportedVersions: MODERN_PROTOCOL_VERSIONS,
		capabilities: CAPABILITIES,
		instructions: 'This server exposes table CRUD and workflow execution tools that let you operate on this app\'s data.'
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

/** What the Mcp-Name header is matched against (tools/call uses name, resources/read uses uri). See the spec's Standard Request Headers table. */
function getRequestTargetName(method: string, params: unknown): string | undefined {
	const p = params as { name?: string; uri?: string } | undefined;
	if (method === 'tools/call') return p?.name;
	if (method === 'resources/read') return p?.uri;
	return undefined;
}

// tools/list and resources/read now require a CacheableResult (ttlMs/cacheScope), made
// mandatory in 2026-07-28. Spec: /specification/2026-07-28/changelog (Minor changes #5).
// Other methods (tools/call etc.) are not subject to this.
// tools/list differs per appId (private — only valid within the scope of the token's
// permissions), while resources/read serves the same static HTML template for every app,
// so it's fine to mark it public with a longer ttl.
const CACHEABLE_HINTS: Partial<Record<string, { ttlMs: number; cacheScope: 'public' | 'private' }>> = {
	'tools/list': { ttlMs: 60_000, cacheScope: 'private' },
	'resources/read': { ttlMs: 86_400_000, cacheScope: 'public' }
};

/** Processes a single JSON-RPC message. A pure function with no SvelteKit dependency (can be called directly from vitest too). */
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
	// Modern-era detection. See the comment above — the detection criterion itself is
	// Boann's own implementation choice.
	const isModern = requestedProtocolVersion !== undefined;

	function respond(httpStatus: number, code: number, message: string, data?: unknown): McpResponse {
		if (isNotification) return { httpStatus: 202, body: null };
		return { httpStatus, body: rpcError(rpcId, code, message, data) };
	}

	if (isModern) {
		// Validation of the required per-request _meta fields. Spec: /specification/2026-07-28/basic/index#meta
		// "A request missing any required field is malformed; the server MUST reject it with
		// JSON-RPC error code -32602 (Invalid params). On HTTP, the response status MUST be 400."
		const clientCapabilities = meta?.[META_CLIENT_CAPABILITIES];
		if (!clientCapabilities || typeof clientCapabilities !== 'object') {
			return respond(400, RpcErrorCode.InvalidParams, `${META_CLIENT_CAPABILITIES} is required`);
		}
		if (!MODERN_PROTOCOL_VERSIONS.includes(requestedProtocolVersion!)) {
			// Spec: /specification/2026-07-28/basic/versioning#protocol-version-negotiation
			return respond(400, McpErrorCode.UnsupportedProtocolVersion, 'Unsupported protocol version', {
				supported: MODERN_PROTOCOL_VERSIONS,
				requested: requestedProtocolVersion
			});
		}
		// HTTP-layer header <-> body matching. Spec: .../streamable-http#server-validation
		// (skipped for direct calls where no headers are passed, e.g. vitest — this is an
		// HTTP-specific requirement)
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
		// The method names and params/result shapes below are dictated by the relevant
		// sections of the MCP spec (the URLs are the primary sources for the methods Boann
		// supports — versioning: basic/versioning, tools/*: server/tools, resources/read:
		// server/resources). The contents of listAppMcpTools/callAppMcpTool/handleResourcesRead
		// (which tools get generated, etc.) are Boann's own design.
		// https://modelcontextprotocol.io/specification/2026-07-28
		let result: unknown;
		switch (method) {
			case 'initialize':
				result = handleInitialize(params);
				break;
			case 'notifications/initialized':
				// The spec-mandated response to a notification (no id) is "202 with no body".
				// This too is not Boann's choice — it's dictated by MCP's Streamable HTTP
				// transport section.
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
				// Modern era: unimplemented methods return 404 (spec: streamable-http#protocol-version-header).
				// Legacy era: unchanged — 200 + JSON-RPC error body (keeps the pre-2025-06-18 behavior).
				return isModern
					? respond(404, RpcErrorCode.MethodNotFound, `Unknown method: ${method}`)
					: { httpStatus: 200, body: rpcError(rpcId, RpcErrorCode.MethodNotFound, `Unknown method: ${method}`) };
		}

		if (isModern && result && typeof result === 'object' && !Array.isArray(result)) {
			// resultType became mandatory on every response in 2026-07-28. Spec: /specification/2026-07-28/basic/index#resultresponses
			// serverInfo is a SHOULD ("without relying on any prior connection state" — a
			// substitute for the serverInfo notification that stateless modern connections
			// can't get via initialize). Spec: basic/index#meta (Per-response protocol fields)
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
 * Processes an authenticated MCP (HTTP) request as JSON-RPC and returns a Response.
 * Regardless of the auth method (static Bearer / OAuth), this is called as common
 * post-processing from both the SvelteKit `/api/apps/[id]/mcp` route and
 * workers-oauth-provider's apiHandler (worker.ts).
 */
export async function handleMcpHttpRequest(db: Db, appId: string, request: Request, env?: ToolEnv): Promise<Response> {
	let body: unknown;
	try {
		body = JSON.parse(await request.text());
	} catch {
		return json(rpcError(null, RpcErrorCode.ParseError, 'Parse error'), { status: 200 });
	}

	// Standard Request Headers for the modern era (2026-07-28). Spec:
	// /specification/2026-07-28/basic/transports/streamable-http#standard-request-headers
	const headers: McpHttpHeaders = {
		protocolVersion: request.headers.get('MCP-Protocol-Version'),
		method: request.headers.get('Mcp-Method'),
		name: request.headers.get('Mcp-Name')
	};

	const { httpStatus, body: resBody } = await handleMcpMessage(db, appId, body, env, headers);
	return resBody === null ? new Response(null, { status: httpStatus }) : json(resBody, { status: httpStatus });
}
