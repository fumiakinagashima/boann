-- apps テーブル（複数テーブル・複数ページを束ねるコンテナ）
CREATE TABLE `apps` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `label` text NOT NULL,
  `icon` text,
  `spec` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint

-- 既存 entity_types から apps をバックフィル（1:1 移行）
INSERT INTO `apps` (`id`, `name`, `label`, `icon`, `created_at`, `updated_at`)
SELECT `id`, `name`, `label`, `icon`, coalesce(`created_at`, unixepoch()), unixepoch()
FROM `entity_types`;
--> statement-breakpoint

-- entity_types に app_id カラム追加
ALTER TABLE `entity_types` ADD COLUMN `app_id` text REFERENCES `apps`(`id`);
--> statement-breakpoint

-- 既存レコードは app_id = id（1:1）
UPDATE `entity_types` SET `app_id` = `id`;
--> statement-breakpoint

-- app_pages テーブル（アプリ内のページ定義）
CREATE TABLE `app_pages` (
  `id` text PRIMARY KEY NOT NULL,
  `app_id` text NOT NULL REFERENCES `apps`(`id`),
  `label` text NOT NULL,
  `table_id` text REFERENCES `entity_types`(`id`),
  `view_type` text NOT NULL DEFAULT 'list',
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint

-- 既存 entity_types から app_pages をバックフィル（1ページずつ）
INSERT INTO `app_pages` (`id`, `app_id`, `label`, `table_id`, `view_type`, `sort_order`, `created_at`)
SELECT `id` || '_p', `id`, `label`, `id`, 'list', 0, coalesce(`created_at`, unixepoch())
FROM `entity_types`;
