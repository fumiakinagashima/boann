-- bookmarks を entity_type 単位から apps 単位に変更する。
-- entity_type_id は「1アプリ=1テーブル」時代の値で、0004_apps.sql 以降は
-- entityTypes.appId 経由で対応する app_id に変換する必要がある。
PRAGMA defer_foreign_keys=true;
--> statement-breakpoint

CREATE TABLE `__new_bookmarks` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `app_id` text NOT NULL REFERENCES `apps`(`id`),
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint

INSERT INTO `__new_bookmarks` (`id`, `account_id`, `app_id`, `created_at`)
SELECT b.`id`, b.`account_id`, COALESCE(et.`app_id`, b.`entity_type_id`), b.`created_at`
FROM `bookmarks` b
LEFT JOIN `entity_types` et ON et.`id` = b.`entity_type_id`
WHERE COALESCE(et.`app_id`, b.`entity_type_id`) IN (SELECT `id` FROM `apps`);
--> statement-breakpoint

DROP TABLE `bookmarks`;
--> statement-breakpoint

ALTER TABLE `__new_bookmarks` RENAME TO `bookmarks`;
