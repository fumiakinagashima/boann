-- ファイル取り込みによるアプリ生成の非同期ジョブ。
-- apply は Queue consumer で実行し、進捗・結果をここで追跡する。
CREATE TABLE `import_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `status` text NOT NULL DEFAULT 'queued',
  `app_id` text,
  `error` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);
