import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync } from 'fs';
import { resolve } from 'path';
import { customers, contacts, deals, activities } from '../src/lib/server/db/schema';
import { generateSeedData } from './seed-data';

const d1Dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const sqliteFile = readdirSync(d1Dir).find((f) => f.endsWith('.sqlite') && !f.includes('metadata'));
if (!sqliteFile) throw new Error('Local D1 SQLite file not found. Run `bun run dev` once first.');

const client = createClient({ url: `file:${resolve(d1Dir, sqliteFile)}` });
const db = drizzle(client);

async function main() {
	console.log('既存データを削除中...');
	await db.delete(activities);
	await db.delete(contacts);
	await db.delete(deals);
	await db.delete(customers);

	const data = generateSeedData();

	for (const customer of data.customers) {
		await db.insert(customers).values(customer);
	}
	for (const contact of data.contacts) {
		await db.insert(contacts).values(contact);
	}
	for (const deal of data.deals) {
		await db.insert(deals).values(deal);
	}
	for (const activity of data.activities) {
		await db.insert(activities).values(activity);
	}

	console.log(
		`完了: 顧客 ${data.customers.length}件 / 担当者 ${data.contacts.length}件 / 案件 ${data.deals.length}件 / 活動履歴 ${data.activities.length}件`
	);
	client.close();
}

main();
