import type { AccountRow } from './db/account-service';

// Editing/deleting is limited to the creator themselves or an admin. An app whose accountId is null
// (e.g. pre-migration data) is treated as an ownerless shared app that anyone can edit or delete
// (matching the existing convention used for workflows, etc.).
export function canManageApp(app: { accountId: string | null }, account: AccountRow | null): boolean {
	if (!app.accountId) return true;
	if (account?.permission === 'admin') return true;
	return app.accountId === account?.id;
}
