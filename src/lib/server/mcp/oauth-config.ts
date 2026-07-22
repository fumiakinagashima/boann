// OAuth 2.1認可サーバー(@cloudflare/workers-oauth-provider)側の設定。
// worker.ts(OAuthProviderの構築)とSvelteKitの/oauth/authorizeルートの両方から参照する、
// フレームワーク非依存の純粋な設定・ヘルパー置き場。
//
// 参照元:
// - OAuth 2.1: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13
// - RFC 8707 (Resource Indicators for OAuth 2.0): https://www.rfc-editor.org/rfc/rfc8707
// - MCP Authorization: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
// - @cloudflare/workers-oauth-provider: https://github.com/cloudflare/workers-oauth-provider
//   (README/oauth-provider.d.tsがoptions・OAuthHelpersの一次情報。node_modulesに実物あり)
//
// authorize/token/registerというパス名自体は仕様が強制する固定値ではない(OAuthProviderの
// authorizeEndpoint/tokenEndpoint/clientRegistrationEndpointに渡す値はBoannが自由に決められる)。
// 固定なのは各エンドポイントが実装しなければいけない"振る舞い"の方(RFC 6749/7591/8414)。

// 静的Bearerトークン(mcp/auth.ts)と共存させる。トークンの見た目で振り分けるのではなく、
// OAuthProviderが「有効なOAuthトークンではない」と判断したリクエストは自動的にdefaultHandler
// (=既存のSvelteKitワーカー)に流れるため、旧来のBearer検証(+server.ts)は無改修のまま生き続ける。
// (この「無効なら黙ってdefaultHandlerに落ちる」という挙動はworkers-oauth-providerライブラリの
// 仕様であり、OAuth自体の仕様ではない。ライブラリのd.tsコメント「Handler for all non-API
// requests or API requests without a valid token」が根拠。)
export const OAUTH_ROUTES = {
	authorize: '/oauth/authorize',
	token: '/oauth/token',
	register: '/oauth/register'
} as const;

// apiRouteはプレフィックス一致のみ(アプリIDが途中に挟まるパスの完全一致は表現できない)ため、
// あえて広めに取り、apiHandler側で「/api/apps/<id>/mcp」以外は既存のSvelteKitワーカーに委譲する。
// これはworkers-oauth-providerのapiRouteオプションの制約(プレフィックスのみ対応)への対処で、
// OAuthやMCPの仕様とは無関係なBoann側の設計判断。
export const MCP_API_ROUTE_PREFIX = '/api/apps/';

// scope文字列の値自体はBoannが決める(OAuth仕様はscopeが空白区切り文字列であることだけ規定し、
// 値の語彙はサーバー実装者が決める領域)。ACL未実装の現状は全ツール一括のこの1つだけ。
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
