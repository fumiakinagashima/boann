import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDb } from '$lib/server/db';
import { listAccounts, createAccount } from '$lib/server/db/account-service';

export const GET: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const rows = await listAccounts(db);
	return json({ rows });
};

export const POST: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB not available' }, { status: 500 });
	const db = createDb(platform.env.DB);
	try {
		const data = await request.json() as { name: string; email?: string; role?: string; permission?: 'general' | 'admin' };
		if (!data.name?.trim()) return json({ error: '名前は必須です' }, { status: 400 });
		const row = await createAccount(db, { name: data.name.trim(), email: data.email?.trim(), role: data.role?.trim(), permission: data.permission });
		return json(row, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
	}
};
