import type { AccountRow } from './db/account-service';

// 編集・削除は作成者本人または管理者のみ。accountId が null（移行前データ等）のアプリは
// 所有者不明の共有アプリとして誰でも編集・削除できる（workflows 等の既存の規約に合わせる）。
export function canManageApp(app: { accountId: string | null }, account: AccountRow | null): boolean {
	if (!app.accountId) return true;
	if (account?.permission === 'admin') return true;
	return app.accountId === account?.id;
}
