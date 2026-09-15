-- Remove the reminder feature. The delivery infrastructure (Cron) remained, but the UI/MCP tool for
-- creating records had already been removed, so it was effectively dormant — dropping the table entirely.
DROP TABLE `reminders`;
