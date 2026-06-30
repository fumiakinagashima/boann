PRAGMA foreign_keys=OFF;
--> statement-breakpoint
DELETE FROM `workflow_runs` WHERE `workflow_id` NOT IN (SELECT `id` FROM `workflows`);
--> statement-breakpoint
CREATE TABLE `workflow_runs_new` (
  `id` text PRIMARY KEY NOT NULL,
  `workflow_id` text NOT NULL REFERENCES `workflows`(`id`),
  `ok` integer NOT NULL,
  `error` text,
  `log` text,
  `started_at` integer NOT NULL,
  `finished_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `workflow_runs_new` SELECT * FROM `workflow_runs`;
--> statement-breakpoint
DROP TABLE `workflow_runs`;
--> statement-breakpoint
ALTER TABLE `workflow_runs_new` RENAME TO `workflow_runs`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
