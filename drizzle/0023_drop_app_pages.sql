-- Remove the page feature (custom page builder).
-- The generic per-entity_types data management screen (/apps/[id]/tables/[tableId]) already
-- provides table viewing/creation/editing/deletion without pages, making app_pages redundant.
DROP TABLE `app_pages`;
