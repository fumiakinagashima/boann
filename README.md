# Boann

AI-first, chat-based no-code app builder and business management platform.
Users type something like "Build me a customer management app" and the AI designs and creates custom tables, fields, pages, and workflows on the fly.

## Features

- **Chat AI** (`/`) — Claude API + MCP tools for creating tables, querying records, generating charts and kanban boards, building workflows, and more. AI can read and write all data through natural language.
- **App Builder** (`/apps/[id]`) — One app can contain multiple tables and multiple pages. Pages define how a table is displayed (list view, detail view, related data sections).
- **Table Management** — Schema editor for creating/editing custom tables and fields (text, number, date, select, multi-select, file, account reference, table reference, etc.).
- **Record CRUD** — Form dialogs for creating/editing records, detail views with related data sections, list views with filters and pagination.
- **Workflows** (`/workflows`) — No-code automation with schedule triggers (cron) and event triggers (record create/update/delete). Steps include: get records, create/update/delete records, send email, send notification, send Slack message, call external API, foreach loop, condition branch. AI-generated, AI-reviewed, manually runnable.
- **Event Triggers** — Record mutations (create/update/delete) enqueue a Cloudflare Queue message. The Queue consumer matches enabled event-trigger workflows and runs them with `@trigger:id` / `@trigger:event` references resolved at runtime.
- **File Import** (`/imports/[id]`) — From the app list, "Create App" → "From a file": upload a text/Markdown/Excel (`.xlsx`) file, AI designs a table schema and import plan (structure only — row data is not imported as records), user reviews and can refine it via chat before applying.
- **External Integrations** (`/settings/integrations`) — Register external API connections (API key, Bearer, Basic auth). Used by AI chat and workflows via `call_external_api`.
- **Email** (`/settings/email`) — Configure an email provider (Resend, AWS SES, or SMTP). Used by workflows, reminders, and password reset.
- **Notifications & Reminders** — In-app notification center with unread count polling. Reminders fire via Cloudflare Cron Trigger and deliver to notification center, email, or Slack.
- **Auth** — Session-based auth (Cloudflare KV, 7-day TTL). Rate-limited sign-in. Password reset via email token. `general` / `admin` permission roles with route-level enforcement.
- **Accounts** (`/accounts`) — Admin-only user management.

## Tech Stack

| Category | Technology |
|---|---|
| Package manager | Bun |
| Frontend | SvelteKit, TypeScript |
| Validation | Zod |
| ORM | DrizzleORM |
| Infrastructure | Cloudflare (Workers, D1, R2, KV, Queue, Cron Triggers) |
| AI | Claude API (Anthropic) |
| Protocol | MCP (Model Context Protocol) |
| i18n | Paraglide-JS (`messages/ja.json`) |
| Testing | Vitest (unit), Playwright (E2E) |

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.x or later
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### 1. Install

```sh
git clone https://github.com/your-org/boann.git
cd boann
bun install
```

### 2. Environment variables

Copy `.dev.vars.example` to `.dev.vars` and fill in values:

```sh
cp .dev.vars.example .dev.vars
```

Minimum required:

```sh
ANTHROPIC_API_KEY="sk-ant-..."  # Anthropic API key
MOCK_AI="false"                 # Set to "true" to use mock responses without an API key
```

For email features, set `EMAIL_PROVIDER` and the corresponding provider keys (`resend`, `ses`, or `smtp`).

### 3. Run database migrations

Apply migrations to the local D1 SQLite database (created under `.wrangler/state/`):

```sh
bunx wrangler d1 migrations apply boann --local
```

The migration does **not** seed any accounts — create one manually:

```sh
# 1. Hash a password
bun -e "
import { hashPassword } from './src/lib/server/auth/password';
console.log(await hashPassword('REPLACE_WITH_A_PASSWORD'));
"

# 2. Insert an admin account (id can be any UUID, e.g. `bun -e "console.log(crypto.randomUUID())"`)
bunx wrangler d1 execute boann --local --command "
INSERT INTO accounts (id, name, email, permission, password_hash)
VALUES ('<uuid>', 'Admin', 'admin@example.com', 'admin', '<hash from step 1>');
"
```

### 4. Start the dev server

```sh
bun dev   # Vite + platformProxy with HMR
```

Open `http://localhost:5173` and sign in at `/signin`.

KV and R2 are auto-created locally under `.wrangler/state/` — no extra setup needed.

> **SMTP note**: The SMTP email provider uses `cloudflare:sockets` (a workerd-only API) and does not work under `bun dev` (Node.js/Vite). Use Resend or AWS SES for local email testing.

### Other commands

```sh
bun run check          # Type-check (svelte-check)
bun run test:unit      # Unit tests (Vitest)
bun run test:e2e       # E2E tests (Playwright)
bun run db:studio      # Open Drizzle Studio to inspect the local DB
```

## Architecture

### Data model

All application data is stored in a small set of core tables:

| Table | Purpose |
|---|---|
| `apps` | App container (name, label, icon, creator `accountId` — edit/delete requires the owner or an admin; null owner = editable by anyone) |
| `entity_types` | Table definitions (name, label, fields; name is unique per app, not globally) |
| `entity_fields` | Field definitions per table (key, type, options, sort order) |
| `entities` | All records across all tables (flexible `data` JSON column) |
| `app_pages` | Page definitions (which table to show, view config, related sections) |
| `workflows` | Workflow definitions (steps, trigger config) |
| `workflow_runs` | Execution logs per workflow run |
| `bookmarks` | Per-account bookmarked apps (shown in the sidebar) |
| `import_jobs` | File-import drafts (uploaded content → AI plan → chat refinements → applied app) |
| `integrations` | External API connection settings |
| `accounts` | User accounts |
| `notifications` | In-app notification center |
| `reminders` | Scheduled reminders (delivery infra only — see note below) |
| `chats` / `chat_messages` | Chat history |
| `ai_settings` | AI model override |
| `email_providers` | Email provider config |

> **Note**: `reminders` has a Cron-driven delivery path (`processDueReminders`), but there is currently no UI or MCP tool that creates rows in it — the feature is effectively dormant until a creation path is added back.

### MCP tools

The AI interacts with the system via MCP tools defined in `src/lib/server/mcp/` (see `src/lib/server/mcp/index.ts` for the authoritative registry):

- **entities**: `create_app`, `create_entity_type`, `create_table`, `create_page`, `add_entity_field`, `list_entity_types`, `get_entity_fields`, `get_entities`, `create_entity`, `update_entity`
- **communication**: `send_email`, `send_notification`, `send_slack_notification`, `delete_read_notifications`
- **documents**: `build_handoff_data` (export data to CSV/Markdown, save to R2)
- **integrations**: `list_integrations`, `call_external_api`
- **workflows**: `save_workflow` (create or update, depending on whether `id` is passed), `list_workflows`, `get_workflow`, `run_workflow`, `get_workflow_run_logs`
- **help**: `get_help`

There is no `delete_entity` MCP tool — record deletion happens only through the REST API (form submissions) or a workflow's `delete_entity` action step (a separate, workflow-only tool catalog in `src/lib/workflow-tools.ts`, not part of this MCP registry).

The main top-level chat (`/`) additionally excludes every `create_*`/`update_*`/`delete_*`-prefixed tool (`src/lib/server/ai/stream.ts`), including `create_app` — despite the system prompt instructing the AI to call `create_app` for "build me an X app" requests. In practice, apps are created via the explicit "Create App" button (blank or from-file) rather than by asking the top-level chat to build one from scratch; the `create_app`-driven natural-language flow only works from within an app-scoped chat context that itself blocks `create_app` (`APP_BUILDER_BLOCKED`), so it is not currently reachable from any chat context. Record writes (`create_entity`, `update_entity`) are excluded from the main chat context by the same prefix rule — they execute only through validated form submissions — but remain available inside an app-scoped builder chat where relevant.

### Workflow execution

Workflows run in `src/lib/server/workflow/run.ts`. Step types:

- **action** — Calls an MCP tool or performs a direct DB operation (create/update/delete entity)
- **condition** — Evaluates a boolean expression, branches to a `then` block
- **foreach** — Iterates over a list result from a prior `get_entities` step

**Reference syntax** in step parameters:
- `@step:<stepId>` — result of a previous step
- `@item:<field>` — current item in a foreach loop
- `@trigger:id` / `@trigger:event` / `@trigger:<fieldKey>` — trigger record ID, event type, and any other field of the triggering record (e.g. `@trigger:createdBy`), including the system fields `createdBy`/`updatedBy`/`createdAt`/`updatedAt`. Event-trigger workflows only; usable in the first condition step
- `@self:account_id` — the workflow owner's account ID (any trigger type). Used e.g. as `@trigger:createdBy != @self:account_id` to detect edits made by someone other than the workflow owner

**Safeguards**:
- Budget cap (`WORKFLOW_MAX_ACTIONS_PER_RUN`) aborts runaway loops
- `WORKFLOW_FOREACH_MAX_ITEMS` limits foreach iterations
- KV-based run lock prevents concurrent execution of the same workflow

### Event trigger flow

```
Record mutation (POST/PATCH/DELETE /api/database/[type]/records)
  → Cloudflare Queue message { type: 'workflow-event', entityTypeId, event, recordId }
  → worker.ts queue handler
  → dispatchWorkflowEvents()  (finds matching enabled event-trigger workflows)
  → runWorkflowNow(db, workflowId, env, triggerContext)
```

### Chat UI components

AI responses can include structured `<ui type="...">` blocks parsed by `src/lib/server/ai/stream.ts` and rendered as interactive components:

| Component | Purpose |
|---|---|
| `Form` | Data entry form (submits to MCP tool via `/api/chat`) |
| `Table` | Data table with sortable columns |
| `Kanban` | Kanban board by status field |
| `Chart` | Bar/line/pie charts |
| `Values` | Key-value summary display |
| `ActionSelector` | Action picker that sends user's choice as next chat message |
| `Workflow` | Inline workflow editor (opens `WorkflowEditorDialog`) |
| `Link` | Record link (opens in new tab to avoid interrupting chat) |
| `Reply` | Inline answer input (single choice, multi-choice, or free text) |
| `DocHandoff` | Download link for AI-generated CSV/Markdown exports |

### Directory structure

```
boann/
├── src/
│   ├── routes/
│   │   ├── +layout.svelte    # Sidebar, theme switcher
│   │   ├── +page.svelte      # Chat screen (/)
│   │   ├── signin/           # Sign in, password reset
│   │   ├── ui/               # UI component demo (/ui)
│   │   ├── settings/         # Settings (/settings, /settings/integrations, /settings/email, /settings/ai, /settings/account)
│   │   ├── apps/             # App builder (/apps/[id], tables, pages, workflows)
│   │   ├── imports/          # File-import plan review + refine chat (/imports/[id])
│   │   ├── accounts/         # Account management (/accounts, admin only)
│   │   ├── workflows/        # Workflow management (/workflows)
│   │   └── api/
│   │       ├── chat/         # Chat API (SSE stream)
│   │       ├── auth/         # Sign in, sign out, password reset
│   │       ├── apps/         # App CRUD
│   │       ├── imports/      # File-import job create/status/refine/apply
│   │       ├── bookmarks/    # App bookmark toggle
│   │       ├── integrations/ # External API connections CRUD
│   │       ├── database/     # Record REST API (tables, records CRUD)
│   │       ├── workflows/    # Workflow CRUD, run, review
│   │       ├── notifications/# Notification center
│   │       └── email/        # Email send, settings
│   └── lib/
│       ├── components/
│       │   ├── ui/           # Design system components
│       │   ├── chat/         # AI chat UI components
│       │   ├── dialog/       # Detail/edit/create dialogs
│       │   ├── database/     # Table management components
│       │   └── icon/         # SVG icon components
│       ├── server/
│       │   ├── db/           # DrizzleORM schema and queries
│       │   ├── mcp/          # MCP tool definitions
│       │   ├── ai/           # Claude API integration, system prompts
│       │   ├── auth/         # Session, password hashing
│       │   ├── workflow/     # Workflow execution engine, event trigger
│       │   ├── imports/      # File-import Queue consumer, Excel/text extraction
│       │   ├── email/        # Email sending
│       │   └── slack/        # Slack Incoming Webhook
│       ├── styles/           # Global styles, theme
│       └── types/            # Shared type definitions
├── messages/                 # i18n resources (ja.json)
├── drizzle/                  # Migration files
├── docs/
│   └── DEPLOY.md
├── worker.ts                 # Cloudflare Workers entry point (Cron + Queue handlers)
├── wrangler.toml
└── wrangler.build.jsonc
```

## Database rules

- Schema changes must go through Drizzle migrations (`drizzle/` directory).
- Use `db.batch([...])` for multiple mutations — `db.transaction()` does not work on Cloudflare D1 in production.

## Deployment

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for production deployment instructions.

## i18n

Japanese strings are defined in `messages/ja.json` and accessed via `m.key()` (Paraglide-JS). The default and only locale is `ja`.

## Theme

Dark / Light / System (OS preference). Switched via the sidebar. Implemented with CSS custom properties (`--color-*`) toggled by a `data-theme` attribute on `<html>`.
