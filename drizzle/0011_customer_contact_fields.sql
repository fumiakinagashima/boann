ALTER TABLE `customers` DROP COLUMN `contact_name`;
--> statement-breakpoint
ALTER TABLE `customers` ADD `postal_code` text;
--> statement-breakpoint
ALTER TABLE `customers` ADD `website` text;
--> statement-breakpoint
ALTER TABLE `contacts` ADD `department` text;
