-- Extend import_jobs into a full import draft covering the whole lifecycle.
-- The design phase is now async too, and this holds the generated plan, the uploaded content, and the refinement chat history.
-- status takes 'designing' | 'ready' | 'applying' | 'done' | 'error' (a string, so no migration needed for it).
ALTER TABLE `import_jobs` ADD COLUMN `filename` text;
--> statement-breakpoint
ALTER TABLE `import_jobs` ADD COLUMN `content` text;
--> statement-breakpoint
ALTER TABLE `import_jobs` ADD COLUMN `plan` text;
--> statement-breakpoint
ALTER TABLE `import_jobs` ADD COLUMN `chat` text NOT NULL DEFAULT '[]';
