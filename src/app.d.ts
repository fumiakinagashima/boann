// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			account: import('$lib/server/db/account-service').AccountRow | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			ctx: ExecutionContext;
			env: {
				DB: D1Database;
				ANTHROPIC_API_KEY: string;
				MOCK_AI: string;
				KV?: KVNamespace;
				R2?: R2Bucket;
				QUEUE?: Queue<import('$lib/server/imports/types').ImportJobMessage>;
				// email (set EMAIL_PROVIDER to 'resend' | 'ses' | 'smtp')
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
		}
	}
}

export {};
