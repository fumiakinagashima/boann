CREATE TABLE `approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_by` text NOT NULL DEFAULT '',
	`data` text DEFAULT '{}' NOT NULL,
	`route` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
