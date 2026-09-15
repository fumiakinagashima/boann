import { eq, asc } from 'drizzle-orm';
import { MASKED_SECRET } from '$lib/types/integration';
import { externalApiConnections } from './schema';
import type { Db } from '.';

export type ExternalApiConnectionRow = {
	id: string;
	name: string;
	url: string;
	headers: Record<string, string>;
	createdAt: Date;
	updatedAt: Date;
	createdBy: string | null;
};

function toRow(r: typeof externalApiConnections.$inferSelect): ExternalApiConnectionRow {
	return { ...r, headers: JSON.parse(r.headers || '{}') as Record<string, string> };
}

// Header values may contain tokens (e.g. Authorization), so — following the same policy as
// integration-service.ts's authConfig — they're always returned masked to the client. Since there's
// no mechanical way to tell "sensitive or not" from the key name alone, every value is masked uniformly (erring on the side of safety over partial masking).
export function maskHeaders(headers: Record<string, string>): Record<string, string> {
	return Object.fromEntries(Object.keys(headers).map((k) => [k, MASKED_SECRET]));
}

// On PATCH, keys still at the masked value (unchanged) keep their existing real value. New or changed
// keys are used as-is, and existing keys that weren't sent (i.e. deleted) are dropped from the result.
export function mergeHeaders(
	existing: Record<string, string>,
	incoming: Record<string, string>
): Record<string, string> {
	const merged: Record<string, string> = {};
	for (const [key, value] of Object.entries(incoming)) {
		merged[key] = value === MASKED_SECRET ? (existing[key] ?? '') : value;
	}
	return merged;
}

export async function listExternalApiConnections(db: Db): Promise<ExternalApiConnectionRow[]> {
	const rows = await db.select().from(externalApiConnections).orderBy(asc(externalApiConnections.name));
	return rows.map(toRow);
}

export async function getExternalApiConnection(db: Db, id: string): Promise<ExternalApiConnectionRow | null> {
	const [row] = await db.select().from(externalApiConnections).where(eq(externalApiConnections.id, id));
	return row ? toRow(row) : null;
}

export async function createExternalApiConnection(
	db: Db,
	input: { name: string; url: string; headers: Record<string, string>; createdBy?: string | null }
): Promise<ExternalApiConnectionRow> {
	const id = crypto.randomUUID();
	await db.insert(externalApiConnections).values({
		id,
		name: input.name,
		url: input.url,
		headers: JSON.stringify(input.headers),
		createdBy: input.createdBy ?? null
	});
	const row = await getExternalApiConnection(db, id);
	if (!row) throw new Error('Failed to create');
	return row;
}

export async function updateExternalApiConnection(
	db: Db,
	id: string,
	input: { name?: string; url?: string; headers?: Record<string, string> }
): Promise<ExternalApiConnectionRow | null> {
	const existing = await getExternalApiConnection(db, id);
	if (!existing) return null;
	const headers = input.headers !== undefined ? mergeHeaders(existing.headers, input.headers) : undefined;
	await db
		.update(externalApiConnections)
		.set({
			...(input.name !== undefined && { name: input.name }),
			...(input.url !== undefined && { url: input.url }),
			...(headers !== undefined && { headers: JSON.stringify(headers) }),
			updatedAt: new Date()
		})
		.where(eq(externalApiConnections.id, id));
	return getExternalApiConnection(db, id);
}

export async function deleteExternalApiConnection(db: Db, id: string): Promise<void> {
	await db.delete(externalApiConnections).where(eq(externalApiConnections.id, id));
}

export type ExternalApiConnectionOption = { id: string; name: string };

/** Fetches a list without headers (which include credentials), for selecting the target of a workflow's "call external API" action. */
export async function listExternalApiConnectionsForWorkflow(db: Db): Promise<ExternalApiConnectionOption[]> {
	return db
		.select({ id: externalApiConnections.id, name: externalApiConnections.name })
		.from(externalApiConnections)
		.orderBy(asc(externalApiConnections.name));
}

/**
 * If endpoint is a relative path or omitted, joins it onto connection.url. If it's an absolute URL,
 * only allows one on the same origin as connection.url (a guard so that, since headers carry credentials,
 * secrets can't leak to another host even if endpoint gets swapped out via a workflow's dynamic reference value).
 */
export function resolveConnectionUrl(baseUrl: string, endpoint: string | undefined): string {
	const base = baseUrl.replace(/\/$/, '');
	if (!endpoint || endpoint === '/') return base;
	if (endpoint.startsWith('http')) {
		if (new URL(endpoint).origin !== new URL(base).origin) {
			throw new Error('endpoint must be a URL on the same host as the connection (url)');
		}
		return endpoint;
	}
	return `${base}/${endpoint.replace(/^\//, '')}`;
}

export type ExternalApiCallResult = { status: number; ok: boolean; body: unknown };

/** Actually calls the external API using the connection's url/headers (for the workflow's call_external_api action). */
export async function callExternalApiConnection(
	connection: { url: string; headers: Record<string, string> },
	input: { endpoint?: string; method: string; body?: unknown }
): Promise<ExternalApiCallResult> {
	const url = resolveConnectionUrl(connection.url, input.endpoint);
	const res = await fetch(url, {
		method: input.method,
		headers: { 'Content-Type': 'application/json', ...connection.headers },
		body: input.body !== undefined ? JSON.stringify(input.body) : undefined
	});
	// TODO: currently assumes a JSON response (`@step:<id>.<path>` references also assume an already
	// JSON.parse'd object/array). Handling of non-JSON responses (plain text/HTML etc.) hasn't been
	// worked out and is deferred (2026-07-22. Already falls back to .text() for non-JSON, which works
	// fine as a plain string for a no-path reference, but behavior when a path is given is still unresolved).
	const ct = res.headers.get('content-type') ?? '';
	const body = ct.includes('application/json') ? await res.json() : await res.text();
	return { status: res.status, ok: res.ok, body };
}
