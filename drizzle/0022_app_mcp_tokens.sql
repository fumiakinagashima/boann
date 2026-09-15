-- Stores the bearer token used to expose an app as an external MCP server.
-- One token per app (app_id is the PK, enforcing a 1:1 relationship; reissuing upserts the existing row).
-- The token itself isn't stored — only its SHA-256 hash — with a short prefix kept separately for display purposes.
CREATE TABLE `app_mcp_tokens` (
	`app_id` text PRIMARY KEY NOT NULL REFERENCES `apps`(`id`),
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`updated_at` integer NOT NULL DEFAULT (unixepoch()),
	`last_used_at` integer,
	`created_by` text
);
