-- Add a components column to app_pages (supports multiple components)
ALTER TABLE `app_pages` ADD COLUMN `components` text DEFAULT '[]';
--> statement-breakpoint

-- Migrate existing records: table_id + view_type → components JSON
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
