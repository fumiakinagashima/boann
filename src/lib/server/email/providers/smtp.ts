// SMTP client for Cloudflare Workers using cloudflare:sockets.
// Port 465 = implicit TLS (secureTransport: 'on').
// Port 587 = STARTTLS (secureTransport: 'starttls', upgrade after STARTTLS command).

import type { Mail } from '../index';

export type SmtpConfig = {
	host: string;
	port: string | number; // stored as string in DB
	secure: string | boolean; // stored as "true"/"false" in DB
	username: string;
	password: string;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

type SmtpResponse = { code: number; lines: string[] };

async function readSmtpResponse(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	buf: { value: string }
): Promise<SmtpResponse> {
	const lines: string[] = [];
	let code = 0;

	while (true) {
		while (!buf.value.includes('\n')) {
			const { value, done } = await reader.read();
			if (done) throw new Error('The SMTP connection was unexpectedly disconnected');
			buf.value += dec.decode(value);
		}
		const nlIdx = buf.value.indexOf('\n');
		const line = buf.value.slice(0, nlIdx).replace(/\r$/, '');
		buf.value = buf.value.slice(nlIdx + 1);

		code = parseInt(line.slice(0, 3), 10);
		lines.push(line.slice(4));
		if (line[3] === ' ') return { code, lines };
	}
}

async function smtpWrite(writer: WritableStreamDefaultWriter<Uint8Array>, cmd: string): Promise<void> {
	await writer.write(enc.encode(cmd + '\r\n'));
}

function mimeEncodeSubject(str: string): string {
	const bytes = new TextEncoder().encode(str);
	const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
	return `=?UTF-8?B?${btoa(binary)}?=`;
}

function dotStuff(body: string): string {
	return body
		.split('\n')
		.map((line) => (line.startsWith('.') ? '.' + line : line))
		.join('\n');
}

function buildMimeMessage(mail: Mail): string {
	const toAddresses = Array.isArray(mail.to) ? mail.to : [mail.to];
	const from = mail.fromName ? `"${mail.fromName}" <${mail.from}>` : mail.from;
	const subject = mimeEncodeSubject(mail.subject);
	const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

	const headers = [
		`From: ${from}`,
		`To: ${toAddresses.join(', ')}`,
		`Subject: ${subject}`,
		`MIME-Version: 1.0`,
		`Content-Language: ja`
	];

	let body: string;
	if (mail.html && mail.text) {
		headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
		body = [
			``,
			`--${boundary}`,
			`Content-Type: text/plain; charset=UTF-8`,
			`Content-Transfer-Encoding: 8bit`,
			``,
			dotStuff(mail.text),
			`--${boundary}`,
			`Content-Type: text/html; charset=UTF-8`,
			`Content-Transfer-Encoding: 8bit`,
			``,
			dotStuff(mail.html),
			`--${boundary}--`
		].join('\r\n');
	} else {
		const bodyContent = mail.html ?? mail.text ?? '';
		const contentType = mail.html ? 'text/html' : 'text/plain';
		headers.push(`Content-Type: ${contentType}; charset=UTF-8`);
		headers.push(`Content-Transfer-Encoding: 8bit`);
		body = `\r\n${dotStuff(bodyContent)}`;
	}

	return headers.join('\r\n') + '\r\n' + body + '\r\n.\r\n';
}

export async function sendSmtp(config: SmtpConfig, mail: Mail): Promise<void> {
	let connect: (typeof import('cloudflare:sockets'))['connect'];
	try {
		({ connect } = await import('cloudflare:sockets'));
	} catch {
		throw new Error(
			'SMTP sending is only available in the Cloudflare Workers runtime (it is not available in the local `bun run dev` environment). Please try it in production (after deploying) or with `wrangler dev`. For local testing, use Resend or AWS SES instead.'
		);
	}

	const isSecure = config.secure === true || config.secure === 'true';
	const port = typeof config.port === 'string' ? parseInt(config.port, 10) : config.port;
	const secureTransport: 'on' | 'starttls' = isSecure ? 'on' : 'starttls';
	let socket = connect(`${config.host}:${port}`, { secureTransport, allowHalfOpen: false });

	let reader = socket.readable.getReader() as ReadableStreamDefaultReader<Uint8Array>;
	let writer = socket.writable.getWriter() as WritableStreamDefaultWriter<Uint8Array>;
	const buf = { value: '' };

	const read = () => readSmtpResponse(reader, buf);
	const write = (cmd: string) => smtpWrite(writer, cmd);

	// Greeting
	await read();

	// EHLO
	await write('EHLO boann.app');
	await read();

	if (!isSecure) {
		// STARTTLS handshake
		await write('STARTTLS');
		const starttlsResp = await read();
		if (starttlsResp.code !== 220) {
			throw new Error(`STARTTLS was rejected: ${starttlsResp.lines.join(' ')}`);
		}
		// Upgrade TLS
		reader.releaseLock();
		writer.releaseLock();
		socket = socket.startTls();
		reader = socket.readable.getReader();
		writer = socket.writable.getWriter();
		buf.value = '';
		// Re-EHLO over TLS
		await write('EHLO boann.app');
		await read();
	}

	// AUTH LOGIN
	await write('AUTH LOGIN');
	const authPrompt1 = await read();
	if (authPrompt1.code !== 334) throw new Error(`AUTH error: ${authPrompt1.lines.join(' ')}`);

	await write(btoa(config.username));
	const authPrompt2 = await read();
	if (authPrompt2.code !== 334) throw new Error(`AUTH username error: ${authPrompt2.lines.join(' ')}`);

	await write(btoa(config.password));
	const authResult = await read();
	if (authResult.code !== 235) throw new Error(`SMTP authentication failed: ${authResult.lines.join(' ')}`);

	// MAIL FROM
	await write(`MAIL FROM:<${mail.from}>`);
	const mailFromResp = await read();
	if (mailFromResp.code !== 250) throw new Error(`MAIL FROM error: ${mailFromResp.lines.join(' ')}`);

	// RCPT TO
	const recipients = Array.isArray(mail.to) ? mail.to : [mail.to];
	for (const rcpt of recipients) {
		await write(`RCPT TO:<${rcpt}>`);
		const rcptResp = await read();
		if (rcptResp.code !== 250) throw new Error(`RCPT TO error (${rcpt}): ${rcptResp.lines.join(' ')}`);
	}

	// DATA
	await write('DATA');
	const dataResp = await read();
	if (dataResp.code !== 354) throw new Error(`DATA error: ${dataResp.lines.join(' ')}`);

	await write(buildMimeMessage(mail).slice(0, -2)); // strip trailing \r\n, smtpWrite adds it
	const sendResp = await read();
	if (sendResp.code !== 250) throw new Error(`Message send error: ${sendResp.lines.join(' ')}`);

	// QUIT
	await write('QUIT');
	await socket.close();
}
