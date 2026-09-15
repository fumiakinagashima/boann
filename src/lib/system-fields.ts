/** System fields displayable in list/detail views (not present in entity_fields) */
export const SYSTEM_DISPLAY_FIELDS = [
	{ key: 'createdBy', label: 'Created by', type: 'account' as const, required: false as const, refTable: 'accounts', refLabelKey: 'name' },
	{ key: 'createdAt', label: 'Created at', type: 'timestamp' as const, required: false as const },
	{ key: 'updatedBy', label: 'Updated by', type: 'account' as const, required: false as const, refTable: 'accounts', refLabelKey: 'name' },
	{ key: 'updatedAt', label: 'Updated at', type: 'timestamp' as const, required: false as const },
];
