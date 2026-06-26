ALTER TABLE `workflows` ADD COLUMN `app_id` text REFERENCES apps(id);
