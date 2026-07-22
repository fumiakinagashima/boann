// JSON-RPC 2.0仕様のエンベロープ実装。ここの形(jsonrpc:"2.0"固定・idでの対応付け・
// エラーコードの数値)はBoann独自の設計ではなく仕様がそのまま決めているもの。
// 仕様: https://www.jsonrpc.org/specification
export type JsonRpcId = string | number | null;
export type JsonRpcRequest = { jsonrpc: '2.0'; id?: JsonRpcId; method: string; params?: unknown };

// 仕様が意味を固定している標準エラーコード(§5.1)。Boannが独自に採番したものではない。
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
