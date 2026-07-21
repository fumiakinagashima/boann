-- テーブルごとに外部MCPサーバー経由で許可するCRUD操作を制御する。デフォルトは全許可。
ALTER TABLE entity_types ADD COLUMN mcp_create INTEGER NOT NULL DEFAULT true;
ALTER TABLE entity_types ADD COLUMN mcp_read INTEGER NOT NULL DEFAULT true;
ALTER TABLE entity_types ADD COLUMN mcp_update INTEGER NOT NULL DEFAULT true;
ALTER TABLE entity_types ADD COLUMN mcp_delete INTEGER NOT NULL DEFAULT true;
