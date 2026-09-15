import { describe, it, expect } from 'vitest';
import { handleMcpMessage, LEGACY_PROTOCOL_VERSIONS, MODERN_PROTOCOL_VERSIONS } from './protocol';
import type { Db } from '../db';

// tools/list and tools/call are out of scope since they require DB access (this repo's vitest
// setup has no DB mocking infrastructure). Here we only verify the paths that don't touch the
// DB (initialize/server/discover/ping/resources/read/validation errors).
const db = {} as Db;
const appId = 'app-1';

function modernMeta(overrides: Record<string, unknown> = {}) {
	return {
		'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSIONS[0],
		'io.modelcontextprotocol/clientCapabilities': {},
		...overrides
	};
}

describe('handleMcpMessage: legacy era (initialize handshake)', () => {
	it('defaults to the newest legacy version when the client omits protocolVersion', async () => {
		const res = await handleMcpMessage(db, appId, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
		expect((res.body as any).result.protocolVersion).toBe(LEGACY_PROTOCOL_VERSIONS[0]);
		expect(LEGACY_PROTOCOL_VERSIONS[0]).toBe('2025-11-25');
	});

	it('still honors an explicitly requested older legacy version', async () => {
		const res = await handleMcpMessage(db, appId, {
			jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' }
		});
		expect((res.body as any).result.protocolVersion).toBe('2025-06-18');
	});

	it('keeps legacy unknown-method handling at HTTP 200 with a JSON-RPC error body', async () => {
		const res = await handleMcpMessage(db, appId, { jsonrpc: '2.0', id: 1, method: 'no/such', params: {} });
		expect(res.httpStatus).toBe(200);
		expect((res.body as any).error.code).toBe(-32601);
	});

	it('does not add resultType/_meta to legacy results', async () => {
		const res = await handleMcpMessage(db, appId, { jsonrpc: '2.0', id: 1, method: 'ping', params: {} });
		expect((res.body as any).result).toEqual({});
	});
});

describe('handleMcpMessage: modern era (per-request _meta)', () => {
	it('answers server/discover with supportedVersions/capabilities/resultType/serverInfo', async () => {
		const res = await handleMcpMessage(db, appId, {
			jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: modernMeta() }
		});
		const result = (res.body as any).result;
		expect(result.supportedVersions).toEqual(MODERN_PROTOCOL_VERSIONS);
		expect(result.resultType).toBe('complete');
		expect(result._meta['io.modelcontextprotocol/serverInfo']).toBeDefined();
	});

	it('adds CacheableResult hints (ttlMs/cacheScope) to resources/read', async () => {
		const res = await handleMcpMessage(db, appId, {
			jsonrpc: '2.0', id: 1, method: 'resources/read',
			params: { uri: 'ui://boann/record-view', _meta: modernMeta() }
		});
		const result = (res.body as any).result;
		expect(result.resultType).toBe('complete');
		expect(typeof result.ttlMs).toBe('number');
		expect(result.cacheScope).toBe('public');
	});

	it('rejects a request missing the required clientCapabilities field with 400/-32602', async () => {
		const res = await handleMcpMessage(db, appId, {
			jsonrpc: '2.0', id: 1, method: 'server/discover',
			params: { _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSIONS[0] } }
		});
		expect(res.httpStatus).toBe(400);
		expect((res.body as any).error.code).toBe(-32602);
	});

	it('rejects an unsupported protocol version with UnsupportedProtocolVersionError (-32022)', async () => {
		const res = await handleMcpMessage(db, appId, {
			jsonrpc: '2.0', id: 1, method: 'server/discover',
			params: { _meta: modernMeta({ 'io.modelcontextprotocol/protocolVersion': '1900-01-01' }) }
		});
		expect(res.httpStatus).toBe(400);
		expect((res.body as any).error.code).toBe(-32022);
		expect((res.body as any).error.data.supported).toEqual(MODERN_PROTOCOL_VERSIONS);
	});

	it('returns 404 for an unknown method (unlike the legacy 200 behavior)', async () => {
		const res = await handleMcpMessage(db, appId, {
			jsonrpc: '2.0', id: 1, method: 'no/such', params: { _meta: modernMeta() }
		});
		expect(res.httpStatus).toBe(404);
		expect((res.body as any).error.code).toBe(-32601);
	});

	it('rejects a mismatched MCP-Protocol-Version header with HeaderMismatch (-32020)', async () => {
		const res = await handleMcpMessage(
			db, appId,
			{ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: modernMeta() } },
			undefined,
			{ protocolVersion: '2025-11-25', method: 'server/discover', name: null }
		);
		expect(res.httpStatus).toBe(400);
		expect((res.body as any).error.code).toBe(-32020);
	});

	it('rejects a mismatched Mcp-Name header on resources/read', async () => {
		const res = await handleMcpMessage(
			db, appId,
			{ jsonrpc: '2.0', id: 1, method: 'resources/read', params: { uri: 'ui://boann/record-view', _meta: modernMeta() } },
			undefined,
			{ protocolVersion: MODERN_PROTOCOL_VERSIONS[0], method: 'resources/read', name: 'ui://something/else' }
		);
		expect(res.httpStatus).toBe(400);
		expect((res.body as any).error.code).toBe(-32020);
	});

	it('accepts a request when the headers correctly match the body', async () => {
		const res = await handleMcpMessage(
			db, appId,
			{ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: modernMeta() } },
			undefined,
			{ protocolVersion: MODERN_PROTOCOL_VERSIONS[0], method: 'server/discover', name: null }
		);
		expect(res.httpStatus).toBe(200);
	});
});
