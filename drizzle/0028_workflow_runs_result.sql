-- The result object (JSON) assembled by the set_result action. Used for the run_workflow_* MCP response
-- (structuredContent) and the "Run now" result display. Stays null for workflows that don't use it.
ALTER TABLE workflow_runs ADD COLUMN result TEXT;
