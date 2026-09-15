-- Remove the index-page designation and manage display order via sort_order instead.

-- Drop the apps.index_page_id column (removing the index-page designation)
ALTER TABLE `apps` DROP COLUMN `index_page_id`;
--> statement-breakpoint

-- Add sort_order to entity_types
ALTER TABLE `entity_types` ADD COLUMN `sort_order` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- Add sort_order to workflows
ALTER TABLE `workflows` ADD COLUMN `sort_order` integer NOT NULL DEFAULT 0;
--> statement-breakpoint

-- Renumber existing entity_types starting from 0, in creation order within each app
UPDATE `entity_types` SET `sort_order` = (
  SELECT COUNT(*) FROM `entity_types` t2
  WHERE (t2.`app_id` IS `entity_types`.`app_id`) AND t2.`created_at` < `entity_types`.`created_at`
);
--> statement-breakpoint

-- Renumber existing workflows starting from 0, in creation order within each app
UPDATE `workflows` SET `sort_order` = (
  SELECT COUNT(*) FROM `workflows` w2
  WHERE (w2.`app_id` IS `workflows`.`app_id`) AND w2.`created_at` < `workflows`.`created_at`
);
--> statement-breakpoint

-- Renumber existing app_pages starting from 0, in creation order within each app (auto-created pages all had 0, causing duplicates)
UPDATE `app_pages` SET `sort_order` = (
  SELECT COUNT(*) FROM `app_pages` p2
  WHERE p2.`app_id` = `app_pages`.`app_id`
    AND (p2.`created_at` < `app_pages`.`created_at`
      OR (p2.`created_at` = `app_pages`.`created_at` AND p2.`id` < `app_pages`.`id`))
);
