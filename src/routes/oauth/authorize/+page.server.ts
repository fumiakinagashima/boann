import { error, fail, redirect } from '@sveltejs/kit';
import type { AuthRequest } from '@cloudflare/workers-oauth-provider';
import type { Actions, PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getAppById } from '$lib/server/db/table-service';
import { canManageApp } from '$lib/server/authz';
import { parseMcpResourceAppId, MCP_TOOL_SCOPE, type McpGrantProps } from '$lib/server/mcp/oauth-config';

// このページ自体はhooks.server.tsの通常のセッションガード対象(PUBLIC_PATHSに含めていない)。
// ログインしていなければ自動的に/signinへリダイレクトされるので、ここではlocals.accountが
// 必ず入っている前提でよい。
//
// このファイル全体はworkers-oauth-providerが要求する「認可UIをアプリ側で実装する」契約への
// 対応(ライブラリはparseAuthRequest/lookupClient/completeAuthorizationというヘルパーだけ提供し、
// 画面自体は作らない。README「Usage」節参照)。この画面の「見た目・文言・権限判定(canManageApp)」
// はBoannの設計だが、hidden fieldでAuthRequestの各値を素通りさせる構造や、承認/拒否の結果として
// 何を呼ぶか(completeAuthorization / リダイレクト)はOAuth 2.1の認可コードフロー
// (https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13#section-1.3.1)が要求する手順。

// AuthRequestの各フィールド名(response_type/client_id/redirect_uri/scope/state)はRFC 6749
// §4.1.1が規定する認可リクエストパラメータそのもの。code_challenge/code_challenge_methodは
// PKCE(RFC 7636)、resourceはRFC 8707(oauth-config.tsのコメント参照)。
function authRequestFromForm(form: FormData): AuthRequest {
	return {
		responseType: String(form.get('response_type') ?? ''),
		clientId: String(form.get('client_id') ?? ''),
		redirectUri: String(form.get('redirect_uri') ?? ''),
		scope: String(form.get('scope') ?? '').split(' ').filter(Boolean),
		state: String(form.get('state') ?? ''),
		codeChallenge: form.get('code_challenge') ? String(form.get('code_challenge')) : undefined,
		codeChallengeMethod: form.get('code_challenge_method') ? String(form.get('code_challenge_method')) : undefined,
		resource: form.get('resource') ? String(form.get('resource')) : undefined
	};
}

async function resolveApp(platform: App.Platform | undefined, resource: string | string[] | undefined) {
	if (!platform?.env?.DB) throw error(503, '利用できません');
	const appId = parseMcpResourceAppId(resource);
	if (!appId) throw error(400, 'resourceパラメータが不正です(対象アプリを特定できません)');
	const db = createDb(platform.env.DB);
	const app = await getAppById(db, appId);
	if (!app) throw error(404, 'アプリが見つかりません');
	return { db, app };
}

export const load: PageServerLoad = async ({ request, platform, locals }) => {
	if (!platform?.env?.OAUTH_PROVIDER) throw error(503, '利用できません');

	let authReq: AuthRequest;
	try {
		authReq = await platform.env.OAUTH_PROVIDER.parseAuthRequest(request);
	} catch {
		throw error(400, '不正な認可リクエストです');
	}

	const clientInfo = await platform.env.OAUTH_PROVIDER.lookupClient(authReq.clientId);
	if (!clientInfo) throw error(400, '未登録のクライアントです');

	const { app } = await resolveApp(platform, authReq.resource);
	if (!canManageApp(app, locals.account)) throw error(403, 'このアプリを管理する権限がありません');

	return {
		authReq,
		clientName: clientInfo.clientName || clientInfo.clientId,
		appLabel: app.label
	};
};

export const actions: Actions = {
	approve: async ({ request, platform, locals }) => {
		if (!platform?.env?.OAUTH_PROVIDER || !locals.account) throw error(401, '認証が必要です');

		const authReq = authRequestFromForm(await request.formData());
		const { app } = await resolveApp(platform, authReq.resource);
		if (!canManageApp(app, locals.account)) return fail(403, { message: '権限がありません' });

		const appId = parseMcpResourceAppId(authReq.resource) as string; // resolveAppで検証済み
		const scope = authReq.scope.length ? authReq.scope : [MCP_TOOL_SCOPE];
		const props: McpGrantProps = { accountId: locals.account.id, appId };

		const { redirectTo } = await platform.env.OAUTH_PROVIDER.completeAuthorization({
			request: authReq,
			userId: locals.account.id,
			metadata: { appId, appLabel: app.label },
			scope,
			props
		});
		throw redirect(303, redirectTo);
	},

	deny: async ({ request, platform }) => {
		if (!platform?.env?.OAUTH_PROVIDER) throw error(503, '利用できません');
		const form = await request.formData();
		const clientId = String(form.get('client_id') ?? '');
		const redirectUri = String(form.get('redirect_uri') ?? '');
		const state = String(form.get('state') ?? '');

		// リダイレクト先はhidden fieldの値をそのまま信用せず、登録済みクライアントの
		// redirect_urisに含まれるものだけを許可する(オープンリダイレクト対策。Boann独自の防御で、
		// completeAuthorization()側は同種の検証をライブラリ内部でやっているはずだが、拒否パスは
		// ライブラリを経由しないコードなのでここで明示的に検証している)。
		const clientInfo = await platform.env.OAUTH_PROVIDER.lookupClient(clientId);
		if (!clientInfo || !clientInfo.redirectUris.includes(redirectUri)) throw error(400, '不正なリクエストです');

		// error=access_denied のリダイレクトはRFC 6749 §4.1.2.1が規定する認可エラーレスポンスの形。
		// https://www.rfc-editor.org/rfc/rfc6749#section-4.1.2.1
		const url = new URL(redirectUri);
		url.searchParams.set('error', 'access_denied');
		if (state) url.searchParams.set('state', state);
		throw redirect(303, url.toString());
	}
};
