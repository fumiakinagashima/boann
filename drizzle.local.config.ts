import { readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import type { Config } from 'drizzle-kit';

const d1Dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
// wrangler.toml の env.dev の binding 変更やクリーンアップの度に別ハッシュのファイルが
// 増えうるため、最も新しく更新されたものを採用する（= 現在の設定で実際に使われているDB）。
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
