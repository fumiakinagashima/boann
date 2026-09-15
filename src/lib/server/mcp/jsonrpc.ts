// JSON-RPC 2.0 spec envelope implementation. The shape here (fixed jsonrpc:"2.0", matching
// via id, the numeric error codes) is not a Boann-specific design — it's dictated directly
// by the spec.
// Spec: https://www.jsonrpc.org/specification
export type JsonRpcId = string | number | null;
export type JsonRpcRequest = { jsonrpc: '2.0'; id?: JsonRpcId; method: string; params?: unknown };

// Standard error codes whose meaning is fixed by the spec (§5.1). Not numbered by Boann.
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
