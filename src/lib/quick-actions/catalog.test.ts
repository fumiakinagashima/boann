import { describe, it, expect } from 'vitest';
import { isQuickActionId, quickActionCatalog, MAX_QUICK_ACTIONS, DEFAULT_QUICK_ACTION_IDS } from './catalog';

describe('isQuickActionId', () => {
	it('returns true for ids in the catalog', () => {
		for (const action of quickActionCatalog) {
			expect(isQuickActionId(action.id)).toBe(true);
		}
	});

	it('returns false for unknown ids', () => {
		expect(isQuickActionId('not_a_real_tool')).toBe(false);
	});
});

describe('DEFAULT_QUICK_ACTION_IDS', () => {
	it('has at most MAX_QUICK_ACTIONS entries, all valid', () => {
		expect(DEFAULT_QUICK_ACTION_IDS.length).toBeLessThanOrEqual(MAX_QUICK_ACTIONS);
		for (const id of DEFAULT_QUICK_ACTION_IDS) {
			expect(isQuickActionId(id)).toBe(true);
		}
	});
});
