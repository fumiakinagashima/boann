-- Boann initial schema

CREATE TABLE `entity_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL UNIQUE,
	`label` text NOT NULL,
	`icon` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `entity_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`options` text DEFAULT '[]',
	`ref_table` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`entity_type_id`) REFERENCES `entity_types`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type_id` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`entity_type_id`) REFERENCES `entity_types`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `core_custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`table_name` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`options` text DEFAULT '[]',
	`ref_table` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`base_url` text NOT NULL,
	`auth_type` text DEFAULT 'none' NOT NULL,
	`auth_config` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `email_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text DEFAULT 'resend' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`from_address` text DEFAULT '' NOT NULL,
	`from_name` text,
	`signature` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `ai_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`model` text DEFAULT 'claude-haiku-4-5-20251001' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`role` text,
	`permission` text DEFAULT 'general' NOT NULL,
	`password_hash` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'generic' NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`seed_content` text DEFAULT '[]' NOT NULL,
	`account_id` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`remind_at` integer NOT NULL,
	`content` text NOT NULL,
	`channels` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`account_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`account_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`role` text NOT NULL,
	`contents` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`trigger_hour` integer NOT NULL,
	`trigger_minute` integer NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`account_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`ok` integer NOT NULL,
	`error` text,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL
);
