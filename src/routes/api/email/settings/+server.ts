import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { createDb } from '$lib/server/db';
import { emailProviders } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const SETTINGS_ID = 'default';

const providerConfigSchema = z.record(z.string(), z.string()).default({});

const updateEmailSettingsSchema = z.object({
	provider: z.enum(['resend', 'ses', 'smtp']),
	fromAddress: z.string().email(),
	fromName: z.string().optional(),
	signature: z.string().optional(),
	config: z
		.object({
			resend: providerConfigSchema.optional(),
			ses: providerConfigSchema.optional(),
			smtp: providerConfigSchema.optional()
		})
		.default({})
});

export const GET: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB unavailable' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const [row] = await db.select().from(emailProviders).where(eq(emailProviders.id, SETTINGS_ID));
	const config = row ? JSON.parse(row.config || '{}') : {};
	return json({
		provider: row?.provider ?? 'resend',
		fromAddress: row?.fromAddress ?? '',
		fromName: row?.fromName ?? '',
		signature: row?.signature ?? '',
		config: {
			resend: config.resend ?? {},
			ses: config.ses ?? {},
			smtp: config.smtp ?? {}
		}
	});
};

export const PUT: RequestHandler = async ({ request, platform }) => {
	if (!platform?.env?.DB) return json({ error: 'DB unavailable' }, { status: 500 });
	const db = createDb(platform.env.DB);
	const data = updateEmailSettingsSchema.parse(await request.json());

	const values = {
		provider: data.provider,
		config: JSON.stringify(data.config),
		fromAddress: data.fromAddress,
		fromName: data.fromName || null,
		signature: data.signature || null,
		updatedAt: new Date()
	};

	const [existing] = await db.select({ id: emailProviders.id }).from(emailProviders).where(eq(emailProviders.id, SETTINGS_ID));
	if (existing) {
		await db.update(emailProviders).set(values).where(eq(emailProviders.id, SETTINGS_ID));
	} else {
		await db.insert(emailProviders).values({ id: SETTINGS_ID, ...values });
	}

	return json({ success: true });
};
