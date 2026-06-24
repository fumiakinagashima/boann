ALTER TABLE `accounts` ADD `permission` text DEFAULT 'general' NOT NULL;
--> statement-breakpoint
ALTER TABLE `accounts` ADD `password_hash` text;
