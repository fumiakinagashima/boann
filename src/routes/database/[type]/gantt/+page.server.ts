import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { getTableInfo, listRecords } from '$lib/server/db/table-service';

type Deal = {
	id: string;
	title: string;
	customerId: string;
	status: string;
	amount: number | null;
	plannedStart: string | null;
	plannedEnd: string | null;
};

type Customer = { id: string; name: string };

export const load: PageServerLoad = async ({ params, platform }) => {
	if (params.type !== 'deals') {
		redirect(307, `/database/${params.type}`);
	}

	const db = createDb(platform!.env.DB);
	const [info, dealRows, customerRows] = await Promise.all([
		getTableInfo(db, 'deals'),
		listRecords(db, 'deals'),
		listRecords(db, 'customers')
	]);

	const deals: Deal[] = dealRows.map((r) => ({
		id: String(r.id),
		title: String(r.title ?? ''),
		customerId: String(r.customerId ?? ''),
		status: String(r.status ?? 'open'),
		amount: r.amount != null ? Number(r.amount) : null,
		plannedStart: r.plannedStart ? String(r.plannedStart) : null,
		plannedEnd: r.plannedEnd ? String(r.plannedEnd) : null
	}));

	const customers: Customer[] = customerRows.map((r) => ({ id: String(r.id), name: String(r.name ?? '') }));

	return { tableLabel: info?.label ?? '案件', deals, customers };
};
