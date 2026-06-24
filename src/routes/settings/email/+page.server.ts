import type { PageServerLoad } from './$types';
import { createDb } from '$lib/server/db';
import { emailProviders } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ platform, locals }) => {
	const db = createDb(platform!.env.DB);
	const [row] = await db.select().from(emailProviders).where(eq(emailProviders.id, 'default'));
	const config = row ? JSON.parse(row.config || '{}') : {};

	return {
		account: locals.account!,
		settings: {
			provider: row?.provider ?? 'resend',
			fromAddress: row?.fromAddress ?? '',
			fromName: row?.fromName ?? '',
			signature: row?.signature ?? '',
			config: {
				resend: { apiKey: '', ...(config.resend ?? {}) },
				ses: { region: '', accessKeyId: '', secretAccessKey: '', ...(config.ses ?? {}) },
				smtp: { host: '', port: '587', secure: 'false', username: '', password: '', ...(config.smtp ?? {}) }
			}
		}
	};
};
