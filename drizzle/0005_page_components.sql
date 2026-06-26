-- app_pages に components カラムを追加（複数コンポーネント対応）
ALTER TABLE `app_pages` ADD COLUMN `components` text DEFAULT '[]';
--> statement-breakpoint

-- 既存レコードを移行: table_id + view_type → components JSON
UPDATE `app_pages`
SET `components` = json_array(
  json_object(
    'id', id || '_c1',
    'type', 'list',
    'tableId', table_id,
    'actions', json_array('create', 'edit', 'delete')
  )
)
WHERE table_id IS NOT NULL;
