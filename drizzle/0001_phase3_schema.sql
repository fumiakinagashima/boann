-- Phase 3: Add contacts, deals, activities, and user-defined entity system
-- Also adds custom JSON column to customers

ALTER TABLE customers ADD COLUMN custom TEXT DEFAULT '{}';--> statement-breakpoint

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  notes TEXT,
  custom TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);--> statement-breakpoint

CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  title TEXT NOT NULL,
  amount INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'won', 'lost')),
  closed_at INTEGER,
  notes TEXT,
  custom TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);--> statement-breakpoint

CREATE TABLE activities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('customer', 'contact', 'deal', 'entity')),
  entity_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'note' CHECK(type IN ('note', 'call', 'email', 'meeting')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);--> statement-breakpoint

CREATE TABLE entity_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);--> statement-breakpoint

CREATE TABLE entity_fields (
  id TEXT PRIMARY KEY,
  entity_type_id TEXT NOT NULL REFERENCES entity_types(id),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'number', 'select', 'date', 'email', 'tel', 'textarea')),
  required INTEGER NOT NULL DEFAULT 0,
  options TEXT DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);--> statement-breakpoint

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  entity_type_id TEXT NOT NULL REFERENCES entity_types(id),
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
