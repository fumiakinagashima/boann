# Contributing to Boann

Thanks for your interest in contributing! This document covers the basics for getting a change merged.

## Development setup

See the "Getting started" section in [README.md](./README.md) for installing dependencies, provisioning Cloudflare resources, and running the dev server.

## Before opening a pull request

```sh
bun run check       # type-check
bun run test:unit    # unit tests
bun run test:e2e     # end-to-end tests (requires a running dev environment)
```

## Database changes

Any change to the database schema must go through a Drizzle migration — don't hand-edit the database directly. Generate and commit a migration under `drizzle/` alongside your schema change.

## Conventions

- Data fetching for initial page render belongs in `+page.server.ts` `load` functions, not `onMount` (avoids layout shift). `onMount` is reserved for background work like polling.
- Timestamps are stored and displayed in JST; use the helpers in `src/lib/datetime.ts` rather than raw `Date`/`Intl` calls.
- Code that implements an external spec or library contract (OAuth, MCP, the Claude API, Cloudflare APIs, etc.) should note in a comment which parts are mandated by that spec/library versus Boann's own design choices, ideally with a link to the primary source (RFC, official docs, or the library's type definitions).
- Use `db.batch([...])` for multi-statement writes; `db.transaction()` is not supported on Cloudflare D1 in production.

## Commit messages

Please write commit messages in English.

## Reporting issues

Open a GitHub issue with steps to reproduce, expected behavior, and actual behavior. For security issues, please avoid filing a public issue — see below.

## Security

If you discover a security vulnerability, please report it privately rather than opening a public issue. See [SECURITY.md](./SECURITY.md) for details.
