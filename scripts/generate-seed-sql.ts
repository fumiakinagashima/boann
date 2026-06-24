// 本番D1（wrangler d1 execute --remote）へ投入するデモデータのSQLファイルを生成する。
// 使い方:
//   bun run scripts/generate-seed-sql.ts
//   bunx wrangler d1 execute midleton --remote --file ./seed-data.sql
//   rm seed-data.sql

import { writeFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { customers, contacts, deals } from '../src/lib/server/db/schema';
import { generateSeedData } from './seed-data';

const db = drizzle(async () => ({ rows: [] }));

function literal(value: unknown): string {
	if (value === null || value === undefined) return 'NULL';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
	throw new Error(`Unsupported param type: ${typeof value}`);
}

function toStatement(query: { sql: string; params: unknown[] }): string {
	let i = 0;
	return `${query.sql.replace(/\?/g, () => literal(query.params[i++]))};`;
}

const data = generateSeedData();

const lines: string[] = [
	'-- デモデータ投入用SQL（`bun run scripts/generate-seed-sql.ts` で生成、コミットしない）',
	'DELETE FROM activities;',
	'DELETE FROM contacts;',
	'DELETE FROM deals;',
	'DELETE FROM customers;'
];

for (const customer of data.customers) {
	lines.push(toStatement(db.insert(customers).values(customer).toSQL()));
}
for (const contact of data.contacts) {
	lines.push(toStatement(db.insert(contacts).values(contact).toSQL()));
}
for (const deal of data.deals) {
	lines.push(toStatement(db.insert(deals).values(deal).toSQL()));
}

const outFile = 'seed-data.sql';
writeFileSync(outFile, lines.join('\n') + '\n');

console.log(
	`生成完了: 顧客 ${data.customers.length}件 / 担当者 ${data.contacts.length}件 / 案件 ${data.deals.length}件 → ${outFile}`
);
console.log('');
console.log('本番D1へ投入する場合:');
console.log(`  bunx wrangler d1 execute midleton --remote --file ./${outFile}`);
console.log(`  rm ${outFile}`);
