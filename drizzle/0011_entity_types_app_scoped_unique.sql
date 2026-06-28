-- entity_types.name のグローバル UNIQUE を (app_id, name) の複合 UNIQUE に変更する。
-- name はインライン UNIQUE 制約（SQLite の auto-index）なので直接 DROP できず、テーブルを再作成する。
-- app_pages.table_id / entity_fields.entity_type_id 等が entity_types.id を参照するため、
-- id を保持したまま再作成し、defer_foreign_keys で COMMIT 時まで FK チェックを遅延させる。
PRAGMA defer_foreign_keys=true;
--> statement-breakpoint

CREATE TABLE `__new_entity_types` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `label` text NOT NULL,
  `icon` text,
  `app_id` text REFERENCES `apps`(`id`),
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint

INSERT INTO `__new_entity_types` (`id`, `name`, `label`, `icon`, `app_id`, `sort_order`, `created_at`)
SELECT `id`, `name`, `label`, `icon`, `app_id`, `sort_order`, `created_at` FROM `entity_types`;
--> statement-breakpoint

DROP TABLE `entity_types`;
--> statement-breakpoint

ALTER TABLE `__new_entity_types` RENAME TO `entity_types`;
--> statement-breakpoint

CREATE UNIQUE INDEX `entity_types_app_id_name_unique` ON `entity_types` (`app_id`, `name`);
