# Boann

Boann is an AI-first, chat-based no-code platform for building custom apps and managing business data. Instead of dragging widgets onto a canvas, you talk to an AI assistant — "build me an inventory tracker" — and it designs the tables, fields, and workflows for you.

Each app you build is also automatically exposed as a real [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server, so external AI agents (Claude Desktop, Dify, etc.) can read and write your data directly.

## How it works

- **Apps** are containers for one or more custom tables (`entity_types` + `entity_fields` + `entities`). There's no fixed schema — the AI designs tables and fields for you based on natural-language requests in the chat.
- **Workflows** let you automate multi-step actions (notifications, emails, external API calls, record updates) triggered on a schedule, on a data event, or as an MCP tool callable by external agents.
- **MCP server per app** — every app can be published as its own MCP endpoint (`/api/apps/:id/mcp`) with dynamically generated `list_*`/`get_*`/`create_*`/`update_*`/`delete_*` tools for each of its tables, authenticated via a static bearer token or OAuth 2.1.

Boann is a derivative of a larger internal product ("Midleton") with all CRM/SFA-specific functionality (customers, deals, approvals, business cards, etc.) removed, leaving only the general-purpose no-code table/app/workflow engine.

## Tech stack

- **Package manager**: [Bun](https://bun.sh/)
- **Frontend**: [SvelteKit](https://kit.svelte.dev/), TypeScript
- **Validation**: [Zod](https://zod.dev/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Infrastructure**: [Cloudflare](https://developers.cloudflare.com/) (Workers, Wrangler, D1, R2, KV, Queues)
- **AI**: [Claude API](https://docs.anthropic.com/) (Anthropic), via native Anthropic tool use for the in-app chat, and a standalone JSON-RPC 2.0 MCP server for external agents
- **i18n**: [paraglide-js](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) (currently English-only, see `messages/en.json`)
- **Testing**: [Vitest](https://vitest.dev/) (unit), [Playwright](https://playwright.dev/) (e2e)

## Getting started

### Prerequisites

- [Bun](https://bun.sh/)
- A [Cloudflare](https://dash.cloudflare.com/) account (for D1, KV, R2, and Queues — required even for local development, since Wrangler proxies to real Cloudflare resources)
- An [Anthropic API key](https://console.anthropic.com/settings/keys)

### 1. Install dependencies

```sh
bun install
```

### 2. Create your Cloudflare resources

```sh
wrangler d1 create boann
wrangler kv namespace create KV
wrangler kv namespace create OAUTH_KV
wrangler r2 bucket create boann
wrangler queues create boann
```

Copy the resulting IDs into `wrangler.toml`, replacing the `REPLACE_WITH_YOUR_*` placeholders in the `[[d1_databases]]` and `[[kv_namespaces]]` blocks.

### 3. Configure environment variables

```sh
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set at least `ANTHROPIC_API_KEY`. Email sending (`EMAIL_PROVIDER` and related keys) is optional for local development.

### 4. Run database migrations

```sh
bun run db:migrate:local
```

### 5. Start the dev server

```sh
bun run dev
```

### Other useful commands

```sh
bun run check       # type-check (svelte-check)
bun run test:unit    # unit tests (Vitest)
bun run test:e2e     # end-to-end tests (Playwright)
bun run db:studio    # Drizzle Studio against your local DB
```

## Deploying

The project deploys to Cloudflare Workers via Wrangler (`wrangler.toml`, `worker.ts`). See `CONTRIBUTING.md` for how to get involved, and consult the [Wrangler docs](https://developers.cloudflare.com/workers/wrangler/) for deployment details specific to your Cloudflare account.

## License

[MIT](./LICENSE)
