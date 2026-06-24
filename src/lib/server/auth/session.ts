export const SESSION_COOKIE_NAME = 'session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7日

type SessionData = {
	accountId: string;
};

function sessionKey(sessionId: string): string {
	return `session:${sessionId}`;
}

export async function createSession(kv: KVNamespace, accountId: string): Promise<string> {
	const sessionId = crypto.randomUUID();
	const data: SessionData = { accountId };
	await kv.put(sessionKey(sessionId), JSON.stringify(data), { expirationTtl: SESSION_TTL_SECONDS });
	return sessionId;
}

export async function getSessionAccountId(kv: KVNamespace, sessionId: string): Promise<string | null> {
	const raw = await kv.get(sessionKey(sessionId));
	if (!raw) return null;
	const data = JSON.parse(raw) as SessionData;
	return data.accountId;
}

export async function destroySession(kv: KVNamespace, sessionId: string): Promise<void> {
	await kv.delete(sessionKey(sessionId));
}
