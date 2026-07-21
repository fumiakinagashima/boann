export type JsonRpcId = string | number | null;
export type JsonRpcRequest = { jsonrpc: '2.0'; id?: JsonRpcId; method: string; params?: unknown };

export const RpcErrorCode = {
	ParseError: -32700,
	InvalidRequest: -32600,
	MethodNotFound: -32601,
	InvalidParams: -32602,
	InternalError: -32603
} as const;

export function rpcResult(id: JsonRpcId, result: unknown) {
	return { jsonrpc: '2.0' as const, id, result };
}

export function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
	return { jsonrpc: '2.0' as const, id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}
