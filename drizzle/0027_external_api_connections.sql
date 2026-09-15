-- Connection settings dedicated to the workflow "call external API" action (system-wide).
-- A separate-purpose table from the existing `integrations` (used for notification purposes such as Slack).
-- Auth isn't split into per-authType fields — just generic header key/value pairs (stored as JSON in the headers column).
CREATE TABLE `external_api_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`headers` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text
);
