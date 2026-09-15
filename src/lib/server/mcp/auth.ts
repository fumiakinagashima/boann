// This file implements Boann's own Bearer authentication, not something dictated by the MCP
// or OAuth specs (the `Authorization: Bearer <token>` header format itself is a common HTTP
// authentication convention, but the token issuance, hashed storage, and verification scheme
// are Boann's own design). The OAuth 2.1 implementation lives on the `oauth-config.ts` /
// `oauth-api-handler.ts` / `worker.ts` side, coexisting as a separate auth path from this one
// (see the comments in `oauth-config.ts` for details).
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

/** To avoid timing attacks, always compares every character before returning a result, even when the lengths already match. */
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

/** Issues a new Bearer token (re-issuing if one already exists = the old token is invalidated immediately) and returns the plaintext exactly once. */
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

	// Updating the last-used timestamp is best-effort (a failure here doesn't affect the auth result).
	db.update(appMcpTokens).set({ lastUsedAt: new Date() }).where(eq(appMcpTokens.appId, appId)).catch(() => {});
	return { ok: true };
}
