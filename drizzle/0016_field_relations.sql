ALTER TABLE `core_custom_fields` ADD `ref_table` text;
--> statement-breakpoint
ALTER TABLE `entity_fields` RENAME TO `entity_fields_old`;
--> statement-breakpoint
CREATE TABLE `entity_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type_id` text NOT NULL REFERENCES `entity_types`(`id`),
	`key` text NOT NULL,
	`label` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`options` text DEFAULT '[]',
	`ref_table` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `entity_fields` (`id`, `entity_type_id`, `key`, `label`, `type`, `required`, `options`, `sort_order`, `created_at`)
SELECT `id`, `entity_type_id`, `key`, `label`, `type`, `required`, `options`, `sort_order`, `created_at` FROM `entity_fields_old`;
--> statement-breakpoint
DROP TABLE `entity_fields_old`;
