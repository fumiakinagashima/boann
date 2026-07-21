-- アプリを外部MCPサーバーとして公開するためのBearerトークンを保存する。
-- 1アプリにつき1トークン（app_id をPKにして1:1を強制、再発行は既存行をupsert）。
-- トークン自体は保存せずSHA-256ハッシュのみ保存し、表示用に先頭の短いprefixだけ別途保持する。
CREATE TABLE `app_mcp_tokens` (
	`app_id` text PRIMARY KEY NOT NULL REFERENCES `apps`(`id`),
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`updated_at` integer NOT NULL DEFAULT (unixepoch()),
	`last_used_at` integer,
	`created_by` text
);
