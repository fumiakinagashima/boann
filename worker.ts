// Custom Worker entry point (wrangler.toml `main`).
//
// Wraps the SvelteKit-generated worker (built to .svelte-kit/cloudflare/_worker.js via
// wrangler.build.jsonc, see svelte.config.js) and adds a `scheduled` handler for the
// reminder delivery Cron Trigger. Kept outside src/ so svelte-check doesn't try to
// type-check the generated bundle that doesn't exist until `vite build` runs.
import { createDb } from './src/lib/server/db';
import { processDueReminders } from './src/lib/server/reminders/delivery';
import { processDueWorkflows } from './src/lib/server/workflow/run';
import { processImportJob } from './src/lib/server/imports/consumer';
import type { ImportJobMessage } from './src/lib/server/imports/types';
import sveltekitWorker from './.svelte-kit/cloudflare/_worker.js';

export default {
	fetch: sveltekitWorker.fetch,
	async scheduled(_controller, env, ctx) {
		const db = createDb(env.DB);
		ctx.waitUntil(processDueReminders(db, env));
		ctx.waitUntil(processDueWorkflows(db, env));
	},
	// boann-imports キュー: アプリ生成ジョブを非同期処理する。
	// 失敗は consumer 内で握って通知するため、メッセージは原則 ack（リトライしない）。
	async queue(batch, env, _ctx) {
		const db = createDb(env.DB);
		for (const message of batch.messages) {
			await processImportJob(db, env, message.body as ImportJobMessage);
			message.ack();
		}
	}
};
