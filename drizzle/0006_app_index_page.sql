ALTER TABLE `apps` ADD COLUMN `index_page_id` text REFERENCES app_pages(id);
