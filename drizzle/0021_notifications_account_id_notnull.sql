-- account_id IS NULL の通知（ログイン実装前のレガシーデータ）を削除してから NOT NULL 制約を追加する
-- SQLite は ALTER COLUMN をサポートしないためテーブル再作成で対応
DELETE FROM notifications WHERE account_id IS NULL;
CREATE TABLE `notifications_new` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'generic' NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`seed_content` text DEFAULT '[]' NOT NULL,
	`account_id` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
INSERT INTO `notifications_new` SELECT * FROM `notifications`;
DROP TABLE `notifications`;
ALTER TABLE `notifications_new` RENAME TO `notifications`;
