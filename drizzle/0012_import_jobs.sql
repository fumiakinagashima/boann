-- The async job for app generation via file import.
-- apply runs in a Queue consumer; progress and results are tracked here.
CREATE TABLE `import_jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `status` text NOT NULL DEFAULT 'queued',
  `app_id` text,
  `error` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);
