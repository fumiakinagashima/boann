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

// ヘッダーの値は(Authorization等の)トークンを含みうるため、integration-service.tsのauthConfigと
// 同じ方針でクライアントには常にマスクした状態で返す。キー名から機械的に「秘匿かどうか」を
// 判別できないため、全ての値を一律マスクする(部分的にしか隠さないより安全側に倒す)。
export function maskHeaders(headers: Record<string, string>): Record<string, string> {
	return Object.fromEntries(Object.keys(headers).map((k) => [k, MASKED_SECRET]));
}

// PATCH時、マスク値(未変更)のキーは既存の実値を保持する。新規キーや変更された値はそのまま採用し、
// 送信されなかった(削除された)既存キーは結果から除く。
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
	if (!row) throw new Error('作成に失敗しました');
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

/** ワークフローの「外部APIを呼び出す」対象選択用に、ヘッダー(認証情報を含む)を除いた一覧を取得する。 */
export async function listExternalApiConnectionsForWorkflow(db: Db): Promise<ExternalApiConnectionOption[]> {
	return db
		.select({ id: externalApiConnections.id, name: externalApiConnections.name })
		.from(externalApiConnections)
		.orderBy(asc(externalApiConnections.name));
}

/**
 * endpointが相対パス/省略なら connection.url を基点に結合する。絶対URLの場合は
 * connection.url と同一オリジンのものだけ許可する(ヘッダーに認証情報が乗るため、
 * ワークフローの動的な参照値でendpointが差し替わっても他ホストに秘密が漏れないようにするガード)。
 */
export function resolveConnectionUrl(baseUrl: string, endpoint: string | undefined): string {
	const base = baseUrl.replace(/\/$/, '');
	if (!endpoint || endpoint === '/') return base;
	if (endpoint.startsWith('http')) {
		if (new URL(endpoint).origin !== new URL(base).origin) {
			throw new Error('endpoint は連携先(url)と同じホストのURLのみ指定できます');
		}
		return endpoint;
	}
	return `${base}/${endpoint.replace(/^\//, '')}`;
}

export type ExternalApiCallResult = { status: number; ok: boolean; body: unknown };

/** 連携設定のurl/headersを使って実際に外部APIを呼び出す(ワークフローのcall_external_apiアクション用)。 */
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
	// TODO: 現状JSONレスポンスを前提にした実装（result_path/list_pathでの参照もJSON.parse済みの
	// オブジェクト/配列前提）。プレーンテキスト/HTML等の非JSON応答をワークフロー側でどう扱うか
	// （result_path/list_pathを無視して素通しにする等）は未検討・別途対応する（2026-07-22）。
	const ct = res.headers.get('content-type') ?? '';
	const body = ct.includes('application/json') ? await res.json() : await res.text();
	return { status: res.status, ok: res.ok, body };
}
