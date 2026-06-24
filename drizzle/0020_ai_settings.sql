CREATE TABLE `ai_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text DEFAULT 'claude-haiku-4-5-20251001' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
