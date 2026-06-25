import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getTableInfo, getRecord } from '$lib/server/db/table-service';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = createDb(platform!.env.DB);
	const info = await getTableInfo(db, params.type);
	const record = await getRecord(db, params.type, params.id);

	const refLabels: Record<string, string> = {};
	if (info && record) {
		for (const field of info.fields) {
			if (field.type !== 'recordSelect' || !field.refTable) continue;
			const refId = record[field.key];
			if (!refId) continue;
			const refRecord = await getRecord(db, field.refTable, String(refId));
			if (refRecord) refLabels[field.key] = String(refRecord.name ?? refRecord.id);
		}
	}

	return { info, record, refLabels };
};
