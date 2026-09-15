// Fixed-window rate limiting using Cloudflare KV.
// Falls back to allow if KV is not configured.

const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_MAX_REQUESTS = 60;

export async function checkRateLimit(
	kv: KVNamespace | undefined,
	scope: string,
	ip: string,
	opts?: { windowSeconds?: number; maxRequests?: number }
): Promise<{ allowed: boolean; retryAfter?: number }> {
	if (!kv) return { allowed: true };

	const windowSeconds = opts?.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
	const maxRequests = opts?.maxRequests ?? DEFAULT_MAX_REQUESTS;

	const now = Math.floor(Date.now() / 1000);
	const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
	const key = `rl:${scope}:${ip}:${windowStart}`;

	const current = await kv.get(key);
	const count = current ? parseInt(current, 10) : 0;

	if (count >= maxRequests) {
		return { allowed: false, retryAfter: windowStart + windowSeconds - now };
	}

	await kv.put(key, String(count + 1), { expirationTtl: windowSeconds * 2 });
	return { allowed: true };
}
