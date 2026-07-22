// OAuth 2.1認可サーバー(@cloudflare/workers-oauth-provider)側の設定。
// worker.ts(OAuthProviderの構築)とSvelteKitの/oauth/authorizeルートの両方から参照する、
// フレームワーク非依存の純粋な設定・ヘルパー置き場。

// 静的Bearerトークン(mcp/auth.ts)と共存させる。トークンの見た目で振り分けるのではなく、
// OAuthProviderが「有効なOAuthトークンではない」と判断したリクエストは自動的にdefaultHandler
// (=既存のSvelteKitワーカー)に流れるため、旧来のBearer検証(+server.ts)は無改修のまま生き続ける。
export const OAUTH_ROUTES = {
	authorize: '/oauth/authorize',
	token: '/oauth/token',
	register: '/oauth/register'
} as const;

// apiRouteはプレフィックス一致のみ(アプリIDが途中に挟まるパスの完全一致は表現できない)ため、
// あえて広めに取り、apiHandler側で「/api/apps/<id>/mcp」以外は既存のSvelteKitワーカーに委譲する。
export const MCP_API_ROUTE_PREFIX = '/api/apps/';

export const MCP_TOOL_SCOPE = 'mcp';

const MCP_ENDPOINT_PATH_RE = /^\/api\/apps\/([^/]+)\/mcp$/;

export function matchMcpEndpointPath(pathname: string): string | null {
	return MCP_ENDPOINT_PATH_RE.exec(pathname)?.[1] ?? null;
}

/** OAuthの認可コード発行済みグラントに紐付けて保存するアプリ固有の情報。 */
export type McpGrantProps = {
	accountId: string;
	appId: string;
};

/**
 * MCPクライアントが送るresourceパラメータ(RFC 8707、通常は正規のMCPエンドポイントURL)から
 * どのアプリへのアクセス要求かを取り出す。resourceが無い/複数ある/パス形式が合わない場合はnull。
 */
export function parseMcpResourceAppId(resource: string | string[] | undefined): string | null {
	if (!resource || Array.isArray(resource)) return null;
	try {
		return matchMcpEndpointPath(new URL(resource).pathname);
	} catch {
		return null;
	}
}
