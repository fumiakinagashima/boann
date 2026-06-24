import type { Mail } from '../index';

export type SesConfig = {
	region: string;
	access_key_id: string;
	secret_access_key: string;
};

async function sha256hex(data: string): Promise<string> {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		key instanceof Uint8Array ? key.buffer as ArrayBuffer : key,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

function hexEncode(buf: ArrayBuffer): string {
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

async function getSigningKey(
	secretKey: string,
	date: string,
	region: string,
	service: string
): Promise<ArrayBuffer> {
	const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey), date);
	const kRegion = await hmacSha256(kDate, region);
	const kService = await hmacSha256(kRegion, service);
	return hmacSha256(kService, 'aws4_request');
}

export async function sendSes(config: SesConfig, mail: Mail): Promise<void> {
	const { region, access_key_id: accessKeyId, secret_access_key: secretAccessKey } = config;
	const host = `email.${region}.amazonaws.com`;
	const endpoint = `https://${host}/v2/email/outbound-emails`;

	const now = new Date();
	const amzDate = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
	const dateStamp = amzDate.slice(0, 8);

	const toAddresses = Array.isArray(mail.to) ? mail.to : [mail.to];
	const payload = JSON.stringify({
		FromEmailAddress: mail.fromName ? `"${mail.fromName}" <${mail.from}>` : mail.from,
		Destination: { ToAddresses: toAddresses },
		Content: {
			Simple: {
				Subject: { Data: mail.subject, Charset: 'UTF-8' },
				Body: {
					...(mail.html ? { Html: { Data: mail.html, Charset: 'UTF-8' } } : {}),
					...(mail.text ? { Text: { Data: mail.text, Charset: 'UTF-8' } } : {})
				}
			}
		}
	});

	const payloadHash = await sha256hex(payload);
	const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
	const signedHeaders = 'content-type;host;x-amz-date';
	const canonicalRequest = [
		'POST',
		'/v2/email/outbound-emails',
		'',
		canonicalHeaders,
		signedHeaders,
		payloadHash
	].join('\n');

	const credentialScope = `${dateStamp}/${region}/ses/aws4_request`;
	const stringToSign = [
		'AWS4-HMAC-SHA256',
		amzDate,
		credentialScope,
		await sha256hex(canonicalRequest)
	].join('\n');

	const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, 'ses');
	const signature = hexEncode(await hmacSha256(signingKey, stringToSign));
	const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

	const res = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Amz-Date': amzDate,
			Authorization: authHeader
		},
		body: payload
	});

	if (!res.ok) {
		throw new Error(`AWS SES error ${res.status}: ${await res.text()}`);
	}
}
