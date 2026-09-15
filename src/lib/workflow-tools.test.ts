import { describe, it, expect } from 'vitest';
import { buildResultPreview, formatResultPreview, isReferenceOperand, setResultPath } from './workflow-tools';
import type { WorkflowStep } from './types/chat';

describe('buildResultPreview', () => {
	it('keeps scalar reference tokens unresolved', () => {
		const steps: WorkflowStep[] = [
			{ id: 'r1', kind: 'result', label: 'name', key: 'name', valueType: 'scalar', value: '@step:345' }
		];
		expect(buildResultPreview(steps)).toEqual({ name: '@step:345' });
	});

	it('parses an array value into an actual array', () => {
		const steps: WorkflowStep[] = [
			{ id: 'r1', kind: 'result', label: 'city', key: 'city', valueType: 'array', value: '["London","Dublin"]' }
		];
		expect(buildResultPreview(steps)).toEqual({ city: ['London', 'Dublin'] });
	});

	it('falls back to the raw string when the array value is not valid JSON', () => {
		const steps: WorkflowStep[] = [
			{ id: 'r1', kind: 'result', label: 'city', key: 'city', valueType: 'array', value: 'not json' }
		];
		expect(buildResultPreview(steps)).toEqual({ city: 'not json' });
	});

	it('skips result steps with no key yet', () => {
		const steps: WorkflowStep[] = [
			{ id: 'r1', kind: 'result', label: 'New response setting', key: '', valueType: 'scalar', value: '' }
		];
		expect(buildResultPreview(steps)).toEqual({});
	});

	it('walks into condition.then and foreach.body', () => {
		const steps: WorkflowStep[] = [
			{
				id: 'c1',
				kind: 'condition',
				label: 'cond',
				left: '@step:x',
				operator: '==',
				right: '1',
				then: [{ id: 'r1', kind: 'result', label: 'name', key: 'name', valueType: 'scalar', value: 'Tanaka' }]
			},
			{
				id: 'f1',
				kind: 'foreach',
				label: 'loop',
				source: '@step:list',
				body: [{ id: 'r2', kind: 'result', label: 'age', key: 'age', valueType: 'scalar', value: '@item:f1:age' }]
			}
		];
		expect(buildResultPreview(steps)).toEqual({ name: 'Tanaka', age: '@item:f1:age' });
	});

	it('lets a later result step overwrite an earlier one with the same key', () => {
		const steps: WorkflowStep[] = [
			{ id: 'r1', kind: 'result', label: 'a', key: 'name', valueType: 'scalar', value: 'first' },
			{ id: 'r2', kind: 'result', label: 'b', key: 'name', valueType: 'scalar', value: 'second' }
		];
		expect(buildResultPreview(steps)).toEqual({ name: 'second' });
	});

	it('nests a dot-separated key into an object', () => {
		const steps: WorkflowStep[] = [
			{ id: 'r1', kind: 'result', label: 'a', key: 'user.id', valueType: 'scalar', value: '123' },
			{ id: 'r2', kind: 'result', label: 'b', key: 'user.name', valueType: 'scalar', value: 'myname' }
		];
		expect(buildResultPreview(steps)).toEqual({ user: { id: '123', name: 'myname' } });
	});
});

describe('setResultPath', () => {
	it('sets a top-level key', () => {
		const target: Record<string, unknown> = {};
		setResultPath(target, 'name', 'test');
		expect(target).toEqual({ name: 'test' });
	});

	it('builds intermediate objects for a nested key', () => {
		const target: Record<string, unknown> = {};
		setResultPath(target, 'key2.id', '123');
		setResultPath(target, 'key2.name', 'myname');
		expect(target).toEqual({ key2: { id: '123', name: 'myname' } });
	});

	it('overwrites a non-object value found along the path', () => {
		const target: Record<string, unknown> = { key2: 'scalar-already-here' };
		setResultPath(target, 'key2.id', '123');
		expect(target).toEqual({ key2: { id: '123' } });
	});

	it('overwrites a nested object when the same key is later set as a plain scalar', () => {
		const target: Record<string, unknown> = { key2: { id: '123' } };
		setResultPath(target, 'key2', 'now a scalar');
		expect(target).toEqual({ key2: 'now a scalar' });
	});
});

describe('isReferenceOperand', () => {
	it('recognizes all five reference prefixes', () => {
		expect(isReferenceOperand('@trigger:id')).toBe(true);
		expect(isReferenceOperand('@step:sef')).toBe(true);
		expect(isReferenceOperand('@item:1fw:age')).toBe(true);
		expect(isReferenceOperand('@self:account_id')).toBe(true);
		expect(isReferenceOperand('@input:customer_name')).toBe(true);
	});

	it('rejects plain literals and non-strings', () => {
		expect(isReferenceOperand('Tanaka')).toBe(false);
		expect(isReferenceOperand('')).toBe(false);
		expect(isReferenceOperand(42)).toBe(false);
	});
});

describe('formatResultPreview', () => {
	it('renders an empty object', () => {
		expect(formatResultPreview({})).toBe('{}');
	});

	it('leaves reference tokens unquoted but quotes plain string literals', () => {
		const out = formatResultPreview({ name: '@step:345', city: 'Tokyo' });
		expect(out).toBe('{\n  "name": @step:345,\n  "city": "Tokyo"\n}');
	});

	it('quotes each string element of an array, but leaves reference elements unquoted', () => {
		const out = formatResultPreview({ list: ['London', '@item:1fw:age'] });
		expect(out).toBe('{\n  "list": [\n    "London",\n    @item:1fw:age\n  ]\n}');
	});

	it('renders an empty array compactly', () => {
		expect(formatResultPreview({ list: [] })).toBe('{\n  "list": []\n}');
	});

	it('renders a nested object with indentation, unquoting reference tokens at any depth', () => {
		const out = formatResultPreview({ user: { id: '@step:sef', name: 'Tanaka' } });
		expect(out).toBe('{\n  "user": {\n    "id": @step:sef,\n    "name": "Tanaka"\n  }\n}');
	});
});
