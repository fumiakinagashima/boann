-- import_jobs を取り込みドラフト（ライフサイクル全体）に拡張する。
-- 設計フェーズも非同期化し、生成プラン・アップロード本文・修正チャット履歴を保持する。
-- status は 'designing' | 'ready' | 'applying' | 'done' | 'error' を取る（文字列なので移行不要）。
ALTER TABLE `import_jobs` ADD COLUMN `filename` text;
--> statement-breakpoint
ALTER TABLE `import_jobs` ADD COLUMN `content` text;
--> statement-breakpoint
ALTER TABLE `import_jobs` ADD COLUMN `plan` text;
--> statement-breakpoint
ALTER TABLE `import_jobs` ADD COLUMN `chat` text NOT NULL DEFAULT '[]';
