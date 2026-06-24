DROP TABLE `activities`;
--> statement-breakpoint
CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL REFERENCES `customers`(`id`),
	`type` text DEFAULT 'note' NOT NULL,
	`content` text NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`custom` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
