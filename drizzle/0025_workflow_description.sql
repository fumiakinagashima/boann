-- A workflow's description text. Used as the description when published as an MCP tool (falls back to the previous default wording if unset).
ALTER TABLE workflows ADD COLUMN description TEXT;
