import { readdirSync } from 'fs';
import { resolve } from 'path';
import type { Config } from 'drizzle-kit';

const d1Dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const sqliteFile = readdirSync(d1Dir).find((f) => f.endsWith('.sqlite') && !f.includes('metadata'));
if (!sqliteFile) throw new Error('Local D1 SQLite file not found. Run wrangler dev first.');

export default {
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: `file:${resolve(d1Dir, sqliteFile)}`
	}
} satisfies Config;
