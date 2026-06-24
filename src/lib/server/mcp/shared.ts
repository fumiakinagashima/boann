import type { EmailEnv } from '../email';

export type ToolEnv = EmailEnv & {
	ANTHROPIC_API_KEY?: string;
	R2?: R2Bucket;
	KV?: KVNamespace;
	accountId?: string;
	accountName?: string;
};

export function parseJson(s: string | null | undefined): Record<string, unknown> {
	try {
		return JSON.parse(s ?? '{}') ?? {};
	} catch {
		return {};
	}
}

export function mergeCustom(existing: string | null | undefined, incoming: unknown): string {
	const base = parseJson(existing);
	const patch =
		incoming && typeof incoming === 'object' && !Array.isArray(incoming)
			? (incoming as Record<string, unknown>)
			: {};
	return JSON.stringify({ ...base, ...patch });
}

export function now(): Date {
	return new Date();
}

export function toDate(s: string): Date {
	const d = new Date(s);
	if (isNaN(d.getTime())) throw new Error(`無効な日付: ${s}`);
	return d;
}
