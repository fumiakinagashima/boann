import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('hashPassword / verifyPassword', () => {
	it('round-trips a correct password', async () => {
		const hash = await hashPassword('correct-password');
		const result = await verifyPassword('correct-password', hash);
		expect(result.valid).toBe(true);
		expect(result.rehash).toBeUndefined();
	});

	it('rejects an incorrect password', async () => {
		const hash = await hashPassword('correct-password');
		const result = await verifyPassword('wrong-password', hash);
		expect(result.valid).toBe(false);
	});

	it('verifies legacy SHA-256 hashes and returns a PBKDF2 rehash', async () => {
		// SHA-256("password")
		const legacyHash = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
		const result = await verifyPassword('password', legacyHash);
		expect(result.valid).toBe(true);
		expect(result.rehash).toMatch(/^pbkdf2:/);

		// the rehash itself verifies correctly
		const rehashed = await verifyPassword('password', result.rehash!);
		expect(rehashed.valid).toBe(true);
	});

	it('rejects an incorrect password against a legacy SHA-256 hash', async () => {
		const legacyHash = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
		const result = await verifyPassword('wrong-password', legacyHash);
		expect(result.valid).toBe(false);
		expect(result.rehash).toBeUndefined();
	});
});
