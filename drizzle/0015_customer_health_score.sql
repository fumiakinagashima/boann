ALTER TABLE `customers` ADD `health_score` integer;
--> statement-breakpoint
ALTER TABLE `customers` ADD `health_score_level` text;
--> statement-breakpoint
ALTER TABLE `customers` ADD `health_score_summary` text;
--> statement-breakpoint
ALTER TABLE `customers` ADD `health_score_positives` text DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `customers` ADD `health_score_concerns` text DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `customers` ADD `health_score_updated_at` integer;
