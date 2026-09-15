-- Add the creator's account ID to apps.
-- Groundwork for a policy where anyone can create an app, but only the creator or an admin can edit/delete it.
-- Existing rows keep account_id = NULL (treated as ownerless shared apps),
-- and the API follows the same convention as existing workflows: anyone can edit/delete when accountId is null.
ALTER TABLE `apps` ADD COLUMN `account_id` text;
