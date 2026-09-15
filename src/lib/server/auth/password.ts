const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = 'SHA-256';
const KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;
const LEGACY_SHA256_HEX = /^[0-9a-f]{64}$/i;

function toBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array {
	return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: PBKDF2_HASH },
		keyMaterial,
		KEY_LENGTH_BYTES * 8
	);
	return new Uint8Array(bits);
}

async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

/**
 * Hashes a password. Format: `pbkdf2:<iterations>:<saltBase64>:<hashBase64>`
 * If migrating to a different scheme in the future, only this file (hashPassword/verifyPassword) needs to change.
 */
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
	const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
	return `pbkdf2:${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(hash)}`;
}

/**
 * Verifies a password. If `stored` is in the legacy SHA-256 format (a provisional implementation),
 * verify against that instead, and if it matches, return a new PBKDF2-format hash in `rehash` (the
 * caller updates the DB with it).
 */
export async function verifyPassword(
	password: string,
	stored: string
): Promise<{ valid: boolean; rehash?: string }> {
	if (stored.startsWith('pbkdf2:')) {
		const [, iterationsStr, saltB64, hashB64] = stored.split(':');
		const iterations = Number(iterationsStr);
		const salt = fromBase64(saltB64);
		const expected = fromBase64(hashB64);
		const actual = await pbkdf2(password, salt, iterations);
		return { valid: constantTimeEqual(actual, expected) };
	}

	if (LEGACY_SHA256_HEX.test(stored)) {
		const valid = (await sha256Hex(password)) === stored.toLowerCase();
		return { valid, ...(valid ? { rehash: await hashPassword(password) } : {}) };
	}

	return { valid: false };
}
