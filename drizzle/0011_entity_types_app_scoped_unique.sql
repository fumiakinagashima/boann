-- Change entity_types.name's global UNIQUE constraint into a composite UNIQUE on (app_id, name).
-- name is an inline UNIQUE constraint (a SQLite auto-index), so it can't be dropped directly — the table must be recreated.
-- Since app_pages.table_id / entity_fields.entity_type_id etc. reference entity_types.id,
-- it's recreated while preserving id, deferring FK checks until COMMIT via defer_foreign_keys.
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
