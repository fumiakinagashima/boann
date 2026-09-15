-- Drop the spec field (apps.spec). No longer needed since we're moving to the file-import approach.
ALTER TABLE `apps` DROP COLUMN `spec`;
