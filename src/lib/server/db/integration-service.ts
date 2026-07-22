import { MASKED_SECRET } from '$lib/types/integration';
import { integrations } from './schema';
import type { Db } from '.';

const SECRET_FIELDS = ['value', 'password'] as const;

export type IntegrationOption = { id: string; name: string };

/** ワークフローの「外部API呼び出し」対象選択用に、認証情報を含まない一覧を取得する。 */
export async function listIntegrationsForWorkflow(db: Db): Promise<IntegrationOption[]> {
	return db.select({ id: integrations.id, name: integrations.name }).from(integrations).orderBy(integrations.name);
}

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
