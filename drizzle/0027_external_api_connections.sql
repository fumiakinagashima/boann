-- ワークフローの「外部APIを呼び出す」アクション専用の連携設定（システム単位）。
-- 既存の`integrations`（Slack通知等、通知目的の連携）とは別の目的のテーブル。
-- 認証はauthType別のフィールドではなく、汎用的なヘッダーのkey/valueのみ（headers列にJSON保存）。
CREATE TABLE `external_api_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`headers` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_by` text
);
