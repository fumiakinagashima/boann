-- Controls, per table, which CRUD operations are allowed via the external MCP server. All allowed by default.
ALTER TABLE entity_types ADD COLUMN mcp_create INTEGER NOT NULL DEFAULT true;
ALTER TABLE entity_types ADD COLUMN mcp_read INTEGER NOT NULL DEFAULT true;
ALTER TABLE entity_types ADD COLUMN mcp_update INTEGER NOT NULL DEFAULT true;
ALTER TABLE entity_types ADD COLUMN mcp_delete INTEGER NOT NULL DEFAULT true;
