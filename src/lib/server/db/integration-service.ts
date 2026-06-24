import { MASKED_SECRET } from '$lib/types/integration';

const SECRET_FIELDS = ['value', 'password'] as const;

// 秘匿フィールド（トークン・パスワード）をクライアント向けにマスクする
export function maskAuthConfig(authConfig: Record<string, string>): Record<string, string> {
	const masked = { ...authConfig };
	for (const key of SECRET_FIELDS) {
		if (masked[key]) masked[key] = MASKED_SECRET;
	}
	return masked;
}

// PATCH時、秘匿フィールドがマスク値（未変更）のままなら既存値を保持する
export function mergeAuthConfig(
	existing: Record<string, string>,
	incoming: Record<string, string>
): Record<string, string> {
	const merged = { ...incoming };
	for (const key of SECRET_FIELDS) {
		if (merged[key] === MASKED_SECRET) {
			merged[key] = existing[key] ?? '';
		}
	}
	return merged;
}
