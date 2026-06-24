CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`remind_at` integer NOT NULL,
	`content` text NOT NULL,
	`channels` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`account_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
