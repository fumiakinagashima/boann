ALTER TABLE workflows ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'schedule';
--> statement-breakpoint
ALTER TABLE workflows ADD COLUMN trigger_event TEXT;
--> statement-breakpoint
ALTER TABLE workflows ADD COLUMN trigger_entity_type_id TEXT;
