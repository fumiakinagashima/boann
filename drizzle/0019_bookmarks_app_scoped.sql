-- Change bookmarks from being scoped per entity_type to being scoped per app.
-- entity_type_id is a value from the "1 app = 1 table" era; since 0004_apps.sql it needs to be
-- converted to the corresponding app_id via entityTypes.appId.
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
