CREATE TABLE `core_custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`options` text DEFAULT '[]',
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `activities` ADD `custom` text DEFAULT '{}';
