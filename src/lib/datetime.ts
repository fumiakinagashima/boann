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
 * `<input type="datetime-local">` の値（"YYYY-MM-DDTHH:mm"、JSTのウォールクロック）を、
 * 対応する Date（UTC instant）に変換する。
 * 実行環境のローカルタイムゾーン（Cloudflare Workers は常にUTC）に依存しないようにするため、
 * `new Date(value)` ではなく明示的に +09:00 オフセットを付与する。
 */
export function parseJstDatetime(value: string): Date {
	return new Date(`${value}+09:00`);
}

/** Date を JST の "YYYY/MM/DD HH:mm" 表示用文字列に変換する。 */
export function formatJstDateTime(d: string | Date): string {
	const dt = typeof d === 'string' ? new Date(d) : d;
	const { year, month, day, hour, minute } = getJstParts(dt);
	return `${year}/${month}/${day} ${hour}:${minute}`;
}

/** Date を `<input type="datetime-local">` 用の JST の "YYYY-MM-DDTHH:mm" 文字列に変換する。 */
export function toJstDatetimeLocal(d: Date): string {
	const { year, month, day, hour, minute } = getJstParts(d);
	return `${year}-${month}-${day}T${hour}:${minute}`;
}

/** 現在時刻を `<input type="datetime-local">` 用の JST の "YYYY-MM-DDTHH:mm" 文字列に変換する。 */
export function nowJstDatetimeLocal(): string {
	return toJstDatetimeLocal(new Date());
}

/** Date を JST の時・分（0-23 / 0-59）に変換する。ワークフローのトリガー時刻判定に使う。 */
export function getJstHourMinute(d: Date): { hour: number; minute: number } {
	const { hour, minute } = getJstParts(d);
	return { hour: Number(hour), minute: Number(minute) };
}
