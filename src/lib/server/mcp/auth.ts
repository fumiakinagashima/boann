// このファイルはBoann独自のBearer認証で、MCPやOAuthの仕様が規定しているものではない
// （`Authorization: Bearer <token>`というヘッダー形式自体はHTTP認証の一般的な慣習だが、
// トークンの発行・ハッシュ保存・検証方式はBoannが独自に設計したもの）。OAuth 2.1側の実装は
// `oauth-config.ts`/`oauth-api-handler.ts`/`worker.ts`側にあり、こちらとは別の認証経路として
// 共存させている（詳細は`oauth-config.ts`のコメント参照）。
import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { appMcpTokens } from '../db/schema';

const TOKEN_PREFIX = 'boann_mcp_';

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function shortPrefix(token: string): string {
	return `${token.slice(0, TOKEN_PREFIX.length + 6)}…`;
}

/** タイミング攻撃を避けるため、長さが同じでも常に全文字を比較してから結果を返す。 */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export type McpTokenStatus = {
	issued: boolean;
	tokenPrefix: string | null;
	createdAt: number | null;
	lastUsedAt: number | null;
};

export async function getMcpTokenStatus(db: Db, appId: string): Promise<McpTokenStatus> {
	const [row] = await db.select().from(appMcpTokens).where(eq(appMcpTokens.appId, appId));
	if (!row) return { issued: false, tokenPrefix: null, createdAt: null, lastUsedAt: null };
	return {
		issued: true,
		tokenPrefix: row.tokenPrefix,
		createdAt: row.createdAt ? Math.floor(row.createdAt.getTime() / 1000) : null,
		lastUsedAt: row.lastUsedAt ? Math.floor(row.lastUsedAt.getTime() / 1000) : null
	};
}

/** 新しいBearerトークンを発行（既存があれば再発行=旧トークンは即座に失効）し、平文を1回だけ返す。 */
export async function issueMcpToken(db: Db, appId: string, accountId?: string | null): Promise<string> {
	const token = TOKEN_PREFIX + toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
	const tokenHash = await sha256Hex(token);
	const tokenPrefix = shortPrefix(token);
	await db
		.insert(appMcpTokens)
		.values({ appId, tokenHash, tokenPrefix, createdBy: accountId ?? null })
		.onConflictDoUpdate({
			target: appMcpTokens.appId,
			set: { tokenHash, tokenPrefix, updatedAt: new Date(), createdBy: accountId ?? null }
		});
	return token;
}

export async function deleteMcpToken(db: Db, appId: string): Promise<void> {
	await db.delete(appMcpTokens).where(eq(appMcpTokens.appId, appId));
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'missing' | 'invalid' };

export async function verifyAppMcpToken(db: Db, appId: string, authHeader: string | null): Promise<VerifyResult> {
	if (!authHeader?.startsWith('Bearer ')) return { ok: false, reason: 'missing' };
	const token = authHeader.slice('Bearer '.length).trim();
	if (!token) return { ok: false, reason: 'missing' };

	const [row] = await db.select().from(appMcpTokens).where(eq(appMcpTokens.appId, appId));
	if (!row) return { ok: false, reason: 'invalid' };

	const hash = await sha256Hex(token);
	if (!timingSafeEqual(hash, row.tokenHash)) return { ok: false, reason: 'invalid' };

	// 最終利用日時の更新はベストエフォート（失敗しても認証結果には影響させない）。
	db.update(appMcpTokens).set({ lastUsedAt: new Date() }).where(eq(appMcpTokens.appId, appId)).catch(() => {});
	return { ok: true };
}
