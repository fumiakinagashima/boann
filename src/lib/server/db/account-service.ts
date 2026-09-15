import { eq, asc } from 'drizzle-orm';
import { accounts } from './schema';
import type { Db } from '.';

export type AccountRow = {
	id: string;
	name: string;
	email: string | null;
	role: string | null;
	permission: 'general' | 'admin';
	createdAt: Date;
	updatedAt: Date;
};

function toRow(r: typeof accounts.$inferSelect): AccountRow {
	return {
		id: r.id,
		name: r.name,
		email: r.email,
		role: r.role,
		permission: r.permission as 'general' | 'admin',
		createdAt: r.createdAt,
		updatedAt: r.updatedAt
	};
}

export async function listAccounts(db: Db): Promise<AccountRow[]> {
	const rows = await db.select().from(accounts).orderBy(asc(accounts.name));
	return rows.map(toRow);
}

export async function getAccount(db: Db, id: string): Promise<AccountRow | null> {
	const [r] = await db.select().from(accounts).where(eq(accounts.id, id));
	return r ? toRow(r) : null;
}

/** For the login API only. Returns `AccountRow` with `passwordHash` added. */
export async function getAccountByEmailWithPassword(
	db: Db,
	email: string
): Promise<(AccountRow & { passwordHash: string | null }) | null> {
	const [r] = await db.select().from(accounts).where(eq(accounts.email, email));
	return r ? { ...toRow(r), passwordHash: r.passwordHash } : null;
}

/** For the password-change API only. Returns `AccountRow` with `passwordHash` added. */
export async function getAccountWithPasswordById(
	db: Db,
	id: string
): Promise<(AccountRow & { passwordHash: string | null }) | null> {
	const [r] = await db.select().from(accounts).where(eq(accounts.id, id));
	return r ? { ...toRow(r), passwordHash: r.passwordHash } : null;
}

export async function createAccount(
	db: Db,
	input: { name: string; email?: string; role?: string; permission?: 'general' | 'admin'; passwordHash?: string }
): Promise<AccountRow> {
	const id = crypto.randomUUID();
	const now = new Date();
	await db.insert(accounts).values({
		id,
		name: input.name,
		email: input.email ?? null,
		role: input.role ?? null,
		permission: input.permission ?? 'general',
		passwordHash: input.passwordHash ?? null,
		createdAt: now,
		updatedAt: now
	});
	return (await getAccount(db, id))!;
}

export async function updateAccount(
	db: Db,
	id: string,
	input: { name?: string; email?: string; role?: string; permission?: 'general' | 'admin'; passwordHash?: string }
): Promise<AccountRow> {
	await db.update(accounts)
		.set({ ...input, updatedAt: new Date() })
		.where(eq(accounts.id, id));
	return (await getAccount(db, id))!;
}

export async function deleteAccount(db: Db, id: string): Promise<void> {
	await db.delete(accounts).where(eq(accounts.id, id));
}
