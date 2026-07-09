import { describe, it, expect } from 'vitest';
import { preQuoteReferences, compare } from './run';

describe('preQuoteReferences', () => {
	it('quotes a bare reference used as a JSON value', () => {
		const out = preQuoteReferences('{"customer_id": @step:1, "note": "hi"}');
		expect(JSON.parse(out)).toEqual({ customer_id: '@step:1', note: 'hi' });
	});

	it('quotes a bare @trigger/@self/@item reference at the end of an object', () => {
		expect(JSON.parse(preQuoteReferences('{"customer_id": @trigger:id}'))).toEqual({ customer_id: '@trigger:id' });
		expect(JSON.parse(preQuoteReferences('{"account_id": @self:account_id}'))).toEqual({ account_id: '@self:account_id' });
		expect(JSON.parse(preQuoteReferences('{"id": @item:abc123:field_key}'))).toEqual({ id: '@item:abc123:field_key' });
	});

	it('is idempotent for already-quoted references', () => {
		const input = '{"customer_id": "@step:1"}';
		expect(preQuoteReferences(input)).toBe(input);
	});

	it('does not corrupt reference-like text inside an unrelated string value', () => {
		const input = '{"note":"please refer to @self:account_id for details"}';
		expect(preQuoteReferences(input)).toBe(input);
		expect(() => JSON.parse(preQuoteReferences(input))).not.toThrow();
	});
});

describe('compare', () => {
	it('compares numeric-looking strings numerically for ordering operators', () => {
		expect(compare({ type: 'string', value: '10' }, '>', { type: 'string', value: '9' })).toBe(true);
		expect(compare({ type: 'string', value: '10' }, '<', { type: 'string', value: '9' })).toBe(false);
	});

	it('falls back to lexicographic comparison when values are not numeric', () => {
		expect(compare({ type: 'string', value: 'b' }, '>', { type: 'string', value: 'a' })).toBe(true);
	});

	it('compares numbers normally', () => {
		expect(compare({ type: 'number', value: 10 }, '>', { type: 'number', value: 9 })).toBe(true);
	});

	it('coerces a numeric right-hand value when left is boolean', () => {
		expect(compare({ type: 'boolean', value: true }, '==', { type: 'number', value: 1 })).toBe(true);
		expect(compare({ type: 'boolean', value: false }, '==', { type: 'number', value: 0 })).toBe(true);
		expect(compare({ type: 'boolean', value: true }, '==', { type: 'number', value: 0 })).toBe(false);
	});

	it('throws on an unsupported operator', () => {
		expect(() => compare({ type: 'string', value: 'a' }, '~=', { type: 'string', value: 'a' })).toThrow();
	});
});
