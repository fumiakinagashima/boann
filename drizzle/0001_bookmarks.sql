CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`entity_type_id` text NOT NULL REFERENCES `entity_types`(`id`),
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
