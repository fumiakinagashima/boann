import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getTableInfo, listRecords } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = createDb(platform!.env.DB);
	const info = await getTableInfo(db, params.type);
	const refLabels: Record<string, Record<string, string>> = {};
	if (!info) return { info: null, rows: [], refLabels };
	const rows = await listRecords(db, params.type);

	for (const field of info.fields) {
		if (field.type !== 'recordSelect' || !field.refTable || !field.listable) continue;
		const refRows = await listRecords(db, field.refTable);
		refLabels[field.key] = Object.fromEntries(
			refRows.map((r) => [String(r.id), String(r.name ?? r.id)])
		);
	}

	return { info, rows, refLabels };
};
