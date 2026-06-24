import type { PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { createDb } from '$lib/server/db';
import { getTableInfo, getRecord } from '$lib/server/db/table-service';
import { customers } from '$lib/server/db/schema';
import { getCachedCustomerHealthScore } from '$lib/server/ai/customer-health';
import type { CustomerHealthScoreResult } from '../../../api/customers/[id]/health-score/+server';

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

	let healthScore: CustomerHealthScoreResult | null = null;
	if (params.type === 'customers' && record) {
		const [customer] = await db.select().from(customers).where(eq(customers.id, params.id));
		const cached = customer ? getCachedCustomerHealthScore(customer) : null;
		if (cached) {
			healthScore = { ...cached, updatedAt: cached.updatedAt.toISOString() };
		}
	}

	return { info, record, refLabels, healthScore };
};
