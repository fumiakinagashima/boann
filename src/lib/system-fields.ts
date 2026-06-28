/** 一覧・詳細ビューで表示できるシステムフィールド（entity_fields には存在しない） */
export const SYSTEM_DISPLAY_FIELDS = [
	{ key: 'createdBy', label: '登録者', type: 'account' as const, required: false as const, refTable: 'accounts', refLabelKey: 'name' },
	{ key: 'createdAt', label: '登録日時', type: 'timestamp' as const, required: false as const },
	{ key: 'updatedBy', label: '更新者', type: 'account' as const, required: false as const, refTable: 'accounts', refLabelKey: 'name' },
	{ key: 'updatedAt', label: '更新日時', type: 'timestamp' as const, required: false as const },
];
