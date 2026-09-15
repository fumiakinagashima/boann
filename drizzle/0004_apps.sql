-- apps table (a container bundling multiple tables and multiple pages)
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

-- Backfill apps from existing entity_types (1:1 migration)
INSERT INTO `apps` (`id`, `name`, `label`, `icon`, `created_at`, `updated_at`)
SELECT `id`, `name`, `label`, `icon`, coalesce(`created_at`, unixepoch()), unixepoch()
FROM `entity_types`;
--> statement-breakpoint

-- Add an app_id column to entity_types
ALTER TABLE `entity_types` ADD COLUMN `app_id` text REFERENCES `apps`(`id`);
--> statement-breakpoint

-- For existing records, app_id = id (1:1)
UPDATE `entity_types` SET `app_id` = `id`;
--> statement-breakpoint

-- app_pages table (page definitions within an app)
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

-- Backfill app_pages from existing entity_types (one page each)
INSERT INTO `app_pages` (`id`, `app_id`, `label`, `table_id`, `view_type`, `sort_order`, `created_at`)
SELECT `id` || '_p', `id`, `label`, `id`, 'list', 0, coalesce(`created_at`, unixepoch())
FROM `entity_types`;
