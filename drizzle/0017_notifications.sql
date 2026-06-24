CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'generic' NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`seed_content` text DEFAULT '[]' NOT NULL,
	`account_id` text,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
