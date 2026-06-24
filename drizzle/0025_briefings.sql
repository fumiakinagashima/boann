CREATE TABLE `briefings` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text,
	`date` text NOT NULL,
	`contents` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
