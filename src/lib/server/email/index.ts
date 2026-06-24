import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { emailProviders } from '../db/schema';
import { sendResend, type ResendConfig } from './providers/resend';
import { sendSes, type SesConfig } from './providers/ses';
import { sendSmtp, type SmtpConfig } from './providers/smtp';

export type Mail = {
	from: string;
	fromName?: string;
	to: string | string[];
	subject: string;
	html?: string;
	text?: string;
};

export type EmailProviderType = 'resend' | 'ses' | 'smtp';

export type EmailProviderConfig =
	| { provider: 'resend'; config: ResendConfig }
	| { provider: 'ses'; config: SesConfig }
	| { provider: 'smtp'; config: SmtpConfig };

export async function sendEmail(providerConfig: EmailProviderConfig, mail: Mail): Promise<void> {
	switch (providerConfig.provider) {
		case 'resend':
			return sendResend(providerConfig.config, mail);
		case 'ses':
			return sendSes(providerConfig.config, mail);
		case 'smtp':
			return sendSmtp(providerConfig.config, mail);
	}
}

export type EmailEnv = {
	EMAIL_PROVIDER?: string;
	EMAIL_FROM?: string;
	EMAIL_FROM_NAME?: string;
	RESEND_API_KEY?: string;
	SES_REGION?: string;
	SES_ACCESS_KEY_ID?: string;
	SES_SECRET_ACCESS_KEY?: string;
	SMTP_HOST?: string;
	SMTP_PORT?: string;
	SMTP_SECURE?: string;
	SMTP_USERNAME?: string;
	SMTP_PASSWORD?: string;
};

export type EmailSetup = {
	providerConfig: EmailProviderConfig;
	from: string;
	fromName?: string;
	signature?: string;
};

// DBに保存する設定。プロバイダーごとの設定をすべて保持し、`provider` で現在の選択を切り替える
export type EmailProviderConfigMap = {
	resend?: Record<string, string>;
	ses?: Record<string, string>;
	smtp?: Record<string, string>;
};

function buildProviderConfigFromMap(
	provider: EmailProviderType,
	map: EmailProviderConfigMap
): EmailProviderConfig | null {
	if (provider === 'resend') {
		const c = map.resend;
		if (!c?.apiKey) return null;
		return { provider: 'resend', config: { api_key: c.apiKey } };
	}
	if (provider === 'ses') {
		const c = map.ses;
		if (!c?.region || !c.accessKeyId || !c.secretAccessKey) return null;
		return {
			provider: 'ses',
			config: { region: c.region, access_key_id: c.accessKeyId, secret_access_key: c.secretAccessKey }
		};
	}
	if (provider === 'smtp') {
		const c = map.smtp;
		if (!c?.host || !c.username || !c.password) return null;
		return {
			provider: 'smtp',
			config: { host: c.host, port: c.port || '587', secure: c.secure || 'false', username: c.username, password: c.password }
		};
	}
	return null;
}

export function getEmailSetupFromEnv(env: EmailEnv): EmailSetup | null {
	const provider = env.EMAIL_PROVIDER as EmailProviderType | undefined;
	const from = env.EMAIL_FROM;
	if (!provider || !from) return null;

	const fromName = env.EMAIL_FROM_NAME || undefined;

	if (provider === 'resend') {
		if (!env.RESEND_API_KEY) return null;
		return { providerConfig: { provider: 'resend', config: { api_key: env.RESEND_API_KEY } }, from, fromName };
	}
	if (provider === 'ses') {
		if (!env.SES_REGION || !env.SES_ACCESS_KEY_ID || !env.SES_SECRET_ACCESS_KEY) return null;
		return {
			providerConfig: { provider: 'ses', config: { region: env.SES_REGION, access_key_id: env.SES_ACCESS_KEY_ID, secret_access_key: env.SES_SECRET_ACCESS_KEY } },
			from, fromName
		};
	}
	if (provider === 'smtp') {
		if (!env.SMTP_HOST || !env.SMTP_USERNAME || !env.SMTP_PASSWORD) return null;
		return {
			providerConfig: { provider: 'smtp', config: { host: env.SMTP_HOST, port: env.SMTP_PORT ?? '587', secure: env.SMTP_SECURE ?? 'false', username: env.SMTP_USERNAME, password: env.SMTP_PASSWORD } },
			from, fromName
		};
	}
	return null;
}

export async function getEmailSetupFromDb(db: Db): Promise<EmailSetup | null> {
	const [row] = await db.select().from(emailProviders).where(eq(emailProviders.id, 'default'));
	if (!row || !row.fromAddress) return null;

	const map = JSON.parse(row.config || '{}') as EmailProviderConfigMap;
	const providerConfig = buildProviderConfigFromMap(row.provider as EmailProviderType, map);
	if (!providerConfig) return null;

	return {
		providerConfig,
		from: row.fromAddress,
		fromName: row.fromName ?? undefined,
		signature: row.signature ?? undefined
	};
}

// DB設定（/settings/email）を優先し、未設定の場合は環境変数にフォールバックする
export async function getEmailSetup(db: Db, env?: EmailEnv): Promise<EmailSetup | null> {
	return (await getEmailSetupFromDb(db)) ?? getEmailSetupFromEnv(env ?? {});
}
