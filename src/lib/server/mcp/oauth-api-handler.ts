import { createDb } from '../db';
import { handleMcpHttpRequest } from './protocol';
import { matchMcpEndpointPath, type McpGrantProps } from './oauth-config';

type RawHandler = (request: Request, env: any, ctx: any) => Response | Promise<Response>;

function forbidden(message: string): Response {
	return new Response(JSON.stringify({ error: message }), {
		status: 403,
		headers: { 'Content-Type': 'application/json' }
	});
}

/**
 * workers-oauth-provider の apiHandler。`apiRoute`(`/api/apps/`)はプレフィックス一致のみで
 * アプリIDを含む完全一致は表現できないため、ここで`/api/apps/<id>/mcp`かどうかを判定し、
 * 一致しない場合は素通しで既存のSvelteKitワーカー(defaultHandler)に委譲する。
 * これによりOAuthトークンを持つリクエストが誤って他の`/api/apps/**`エンドポイントに
 * ルーティングされても、今まで通りセッションCookie認証で処理される。
 *
 * この関数のシグネチャ(request, env, ctx)とctx.propsの意味は@cloudflare/workers-oauth-provider
 * が規定する契約(apiHandlerオプション)であり、MCPやOAuth自体の仕様ではない。
 * https://github.com/cloudflare/workers-oauth-provider （README「apiHandler」節、
 * `dist/oauth-provider.d.ts`の`OAuthProviderOptions.apiHandler`のJSDoc参照）。
 * props(accountId/appId)の中身はBoann独自(`/oauth/authorize`のcompleteAuthorization呼び出し側
 * =`src/routes/oauth/authorize/+page.server.ts`で詰めている)。
 */
export async function handleMcpOAuthApiRequest(
	request: Request,
	env: any,
	ctx: { props?: McpGrantProps },
	fallback: RawHandler
): Promise<Response> {
	const url = new URL(request.url);
	const appId = request.method === 'POST' ? matchMcpEndpointPath(url.pathname) : null;
	if (!appId) return fallback(request, env, ctx);

	// OAuthProviderが既にトークンの有効性(署名・失効・resource/audience)を検証済みだが、
	// アプリ単位のテナント分離はこちらでも明示的に再チェックする(既存のassertOwnedByTable等と
	// 同じdefense-in-depthの方針)。
	if (!ctx.props || ctx.props.appId !== appId) return forbidden('Unknown tool: this token is not authorized for this app');

	const db = createDb(env.DB);
	return handleMcpHttpRequest(db, appId, request, env);
}
