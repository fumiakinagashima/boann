import { readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import type { Config } from 'drizzle-kit';

const d1Dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
// A new differently-hashed file can appear each time wrangler.toml's env.dev bindings change
// or state is cleaned up, so pick whichever was most recently updated (= the DB actually in use
// under the current config).
const sqliteFile = readdirSync(d1Dir)
	.filter((f) => f.endsWith('.sqlite') && !f.includes('metadata'))
	.map((f) => ({ f, mtime: statSync(resolve(d1Dir, f)).mtimeMs }))
	.sort((a, b) => b.mtime - a.mtime)[0]?.f;
if (!sqliteFile) throw new Error('Local D1 SQLite file not found. Run `bun run dev` first.');

export default {
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: `file:${resolve(d1Dir, sqliteFile)}`
	}
} satisfies Config;
