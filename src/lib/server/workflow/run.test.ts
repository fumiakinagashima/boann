import { describe, it, expect } from 'vitest';
import { preQuoteReferences, compare, resolveOperand, computeSetResultValue } from './run';

describe('preQuoteReferences', () => {
	it('quotes a bare reference used as a JSON value', () => {
		const out = preQuoteReferences('{"customer_id": @step:1, "note": "hi"}');
		expect(JSON.parse(out)).toEqual({ customer_id: '@step:1', note: 'hi' });
	});

	it('quotes a bare @trigger/@self/@item/@input reference at the end of an object', () => {
		expect(JSON.parse(preQuoteReferences('{"customer_id": @trigger:id}'))).toEqual({ customer_id: '@trigger:id' });
		expect(JSON.parse(preQuoteReferences('{"account_id": @self:account_id}'))).toEqual({ account_id: '@self:account_id' });
		expect(JSON.parse(preQuoteReferences('{"id": @item:abc123:field_key}'))).toEqual({ id: '@item:abc123:field_key' });
		expect(JSON.parse(preQuoteReferences('{"name": @input:customer_name}'))).toEqual({ name: '@input:customer_name' });
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

describe('resolveOperand @input:', () => {
	it('resolves a declared input argument by key', () => {
		const result = resolveOperand('@input:customer_name', new Map(), [], undefined, undefined, { customer_name: '田中' });
		expect(result).toEqual({ type: 'string', value: '田中' });
	});

	it('infers number/boolean types from the argument value', () => {
		expect(resolveOperand('@input:amount', new Map(), [], undefined, undefined, { amount: 100 })).toEqual({ type: 'number', value: 100 });
		expect(resolveOperand('@input:flag', new Map(), [], undefined, undefined, { flag: true })).toEqual({ type: 'boolean', value: true });
	});

	it('throws when the referenced key was not supplied', () => {
		expect(() => resolveOperand('@input:missing', new Map(), [], undefined, undefined, { other: '1' })).toThrow('入力パラメータが指定されていません: missing');
	});

	it('throws when no inputArgs were passed at all', () => {
		expect(() => resolveOperand('@input:customer_name', new Map(), [], undefined, undefined, undefined)).toThrow('入力パラメータが指定されていません: customer_name');
	});
});

describe('computeSetResultValue', () => {
	it('resolves a scalar literal as-is', () => {
		expect(computeSetResultValue('scalar', '東京', 'set', new Map(), [])).toBe('東京');
	});

	it('resolves a scalar @step reference', () => {
		const results = new Map([['sef', { type: 'string' as const, value: '田中' }]]);
		expect(computeSetResultValue('scalar', '@step:sef', 'set', results, [])).toBe('田中');
	});

	it('returns an empty string for an empty scalar value', () => {
		expect(computeSetResultValue('scalar', '', 'set', new Map(), [])).toBe('');
	});

	it('resolves an array of literals and references, preserving order', () => {
		const results = new Map([['sef', { type: 'number' as const, value: 42 }]]);
		const out = computeSetResultValue('array', '["London", "@step:sef", "Dublin"]', 'set', results, []);
		expect(out).toEqual(['London', 42, 'Dublin']);
	});

	it('resolves @item references inside an array', () => {
		const itemStack = [{ foreachStepId: '1fw', item: { age: 30 } }];
		const out = computeSetResultValue('array', '["@item:1fw:age"]', 'set', new Map(), itemStack);
		expect(out).toEqual([30]);
	});

	it('throws when the array value is not valid JSON', () => {
		expect(() => computeSetResultValue('array', 'not json', 'set', new Map(), [])).toThrow(
			'「set」の値が配列形式ではありません'
		);
	});

	it('throws when the array value parses but is not an array', () => {
		expect(() => computeSetResultValue('array', '{"a":1}', 'set', new Map(), [])).toThrow(
			'「set」の値は配列で指定してください'
		);
	});

	it('defaults to an empty array when no value is given', () => {
		expect(computeSetResultValue('array', '', 'set', new Map(), [])).toEqual([]);
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
