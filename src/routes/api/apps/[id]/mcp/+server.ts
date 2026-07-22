import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { errors } from '$lib/server/errors';
import { verifyAppMcpToken } from '$lib/server/mcp/auth';
import { handleMcpHttpRequest } from '$lib/server/mcp/protocol';

function unauthorized(): Response {
	return new Response(JSON.stringify({ error: 'Unauthorized' }), {
		status: 401,
		headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="boann-mcp"' }
	});
}

// 静的Bearerトークンでの認証はここで行う。OAuthアクセストークンで来たリクエストはこのルートに
// 到達する前にworker.ts(OAuthProvider)側のapiHandlerで処理される(有効なOAuthトークンが無い
// 場合のみdefaultHandler経由でここに落ちてくる)。詳細は`mcp/oauth-config.ts`のコメント参照。
export const POST: RequestHandler = async ({ params, request, platform }) => {
	if (!platform?.env?.DB) return errors.serviceUnavailable('利用できません');
	const db = createDb(platform.env.DB);

	const auth = await verifyAppMcpToken(db, params.id, request.headers.get('Authorization'));
	if (!auth.ok) return unauthorized();

	return handleMcpHttpRequest(db, params.id, request, platform.env);
};
