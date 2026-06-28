-- ページリデザイン: 既存ページの table_id を components[0].tableId から補完する
-- components の JSON 形式変換はアプリ層で後方互換処理するため SQL では行わない

UPDATE app_pages
SET table_id = json_extract(components, '$[0].tableId')
WHERE json_type(components, '$') = 'array'
  AND json_array_length(components) > 0
  AND EXISTS (
    SELECT 1 FROM entity_types
    WHERE id = json_extract(app_pages.components, '$[0].tableId')
  );
