-- apps に作成者のアカウントIDを追加する。
-- 作成は誰でも可能、編集・削除は作成者本人または管理者のみに制限するための土台。
-- 既存行は account_id = NULL のままとし（所有者不明の共有アプリ扱い）、
-- API側は accountId が null の場合は誰でも編集・削除できる既存の workflows と同じ規約に従う。
ALTER TABLE `apps` ADD COLUMN `account_id` text;
