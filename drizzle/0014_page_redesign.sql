-- Page redesign: backfill existing pages' table_id from components[0].tableId
-- The components JSON format conversion is handled with backward-compat logic in the app layer, not in SQL

UPDATE app_pages
SET table_id = json_extract(components, '$[0].tableId')
WHERE json_type(components, '$') = 'array'
  AND json_array_length(components) > 0
  AND EXISTS (
    SELECT 1 FROM entity_types
    WHERE id = json_extract(app_pages.components, '$[0].tableId')
  );
