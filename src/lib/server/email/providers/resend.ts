import type { Mail } from '../index';

export type ResendConfig = {
	api_key: string;
};

export async function sendResend(config: ResendConfig, mail: Mail): Promise<void> {
	const toAddresses = Array.isArray(mail.to) ? mail.to : [mail.to];
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.api_key}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: mail.fromName ? `"${mail.fromName}" <${mail.from}>` : mail.from,
			to: toAddresses,
			subject: mail.subject,
			html: mail.html,
			text: mail.text
		})
	});
	if (!res.ok) {
		throw new Error(`Resend API error ${res.status}: ${await res.text()}`);
	}
}
