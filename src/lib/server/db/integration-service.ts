import { MASKED_SECRET } from '$lib/types/integration';
import { integrations } from './schema';
import type { Db } from '.';

const SECRET_FIELDS = ['value', 'password'] as const;

export type IntegrationOption = { id: string; name: string };

/** Fetches a list without credentials, for selecting the target of a workflow's "call external API" action. */
export async function listIntegrationsForWorkflow(db: Db): Promise<IntegrationOption[]> {
	return db.select({ id: integrations.id, name: integrations.name }).from(integrations).orderBy(integrations.name);
}

// Masks sensitive fields (tokens, passwords) for the client
export function maskAuthConfig(authConfig: Record<string, string>): Record<string, string> {
	const masked = { ...authConfig };
	for (const key of SECRET_FIELDS) {
		if (masked[key]) masked[key] = MASKED_SECRET;
	}
	return masked;
}

// On PATCH, keeps the existing value if a sensitive field is still the masked value (unchanged)
export function mergeAuthConfig(
	existing: Record<string, string>,
	incoming: Record<string, string>
): Record<string, string> {
	const merged = { ...incoming };
	for (const key of SECRET_FIELDS) {
		if (merged[key] === MASKED_SECRET) {
			merged[key] = existing[key] ?? '';
		}
	}
	return merged;
}
