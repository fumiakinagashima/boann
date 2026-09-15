const JST_TIME_ZONE = 'Asia/Tokyo';

const jstPartsFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: JST_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

function getJstParts(d: Date): { year: string; month: string; day: string; hour: string; minute: string } {
	const parts = jstPartsFormatter.formatToParts(d);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
	return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/**
 * Converts a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm", JST wall-clock time)
 * into the corresponding Date (UTC instant).
 * Explicitly attaches a +09:00 offset instead of using `new Date(value)`, so the result doesn't
 * depend on the runtime's local timezone (Cloudflare Workers is always UTC).
 */
export function parseJstDatetime(value: string): Date {
	return new Date(`${value}+09:00`);
}

/** Converts a Date into a JST "YYYY/MM/DD HH:mm" display string. */
export function formatJstDateTime(d: string | Date): string {
	const dt = typeof d === 'string' ? new Date(d) : d;
	const { year, month, day, hour, minute } = getJstParts(dt);
	return `${year}/${month}/${day} ${hour}:${minute}`;
}

/** Converts a Date into a JST "YYYY-MM-DDTHH:mm" string for `<input type="datetime-local">`. */
export function toJstDatetimeLocal(d: Date): string {
	const { year, month, day, hour, minute } = getJstParts(d);
	return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** Converts the current time into a JST "YYYY-MM-DDTHH:mm" string for `<input type="datetime-local">`. */
export function nowJstDatetimeLocal(): string {
	return toJstDatetimeLocal(new Date());
}

/** Converts a Date into JST hour/minute (0-23 / 0-59). Used for workflow trigger time checks. */
export function getJstHourMinute(d: Date): { hour: number; minute: number } {
	const { hour, minute } = getJstParts(d);
	return { hour: Number(hour), minute: Number(minute) };
}
