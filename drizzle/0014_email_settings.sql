CREATE TABLE `email_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'resend' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`from_address` text DEFAULT '' NOT NULL,
	`from_name` text,
	`signature` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
