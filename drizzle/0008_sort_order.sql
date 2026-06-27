-- インデックスページ指定を廃止し、表示順を sort_order で管理する。

-- apps.index_page_id カラムを削除（インデックスページ指定を廃止）
ALTER TABLE `apps` DROP COLUMN `index_page_id`;
--> statement-breakpoint

-- entity_types に sort_order を追加
ALTER TABLE `entity_types` ADD COLUMN `sort_order` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- workflows に sort_order を追加
ALTER TABLE `workflows` ADD COLUMN `sort_order` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- 既存 entity_types を app 内の作成順で 0 始まりの連番に
UPDATE `entity_types` SET `sort_order` = (
  SELECT COUNT(*) FROM `entity_types` t2
  WHERE (t2.`app_id` IS `entity_types`.`app_id`) AND t2.`created_at` < `entity_types`.`created_at`
);
--> statement-breakpoint

-- 既存 workflows を app 内の作成順で 0 始まりの連番に
UPDATE `workflows` SET `sort_order` = (
  SELECT COUNT(*) FROM `workflows` w2
  WHERE (w2.`app_id` IS `workflows`.`app_id`) AND w2.`created_at` < `workflows`.`created_at`
);
--> statement-breakpoint

-- 既存 app_pages を app 内の作成順で 0 始まりの連番に振り直す（自動作成ページが全て 0 で重複していたため）
UPDATE `app_pages` SET `sort_order` = (
  SELECT COUNT(*) FROM `app_pages` p2
  WHERE p2.`app_id` = `app_pages`.`app_id`
    AND (p2.`created_at` < `app_pages`.`created_at`
      OR (p2.`created_at` = `app_pages`.`created_at` AND p2.`id` < `app_pages`.`id`))
);
