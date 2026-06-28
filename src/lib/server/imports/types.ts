import type { ImportPlan } from '$lib/server/ai/import-plan';

// Queue に流すアプリ生成ジョブのメッセージ。
export type ImportJobMessage = {
	jobId: string;
	accountId: string;
	plan: ImportPlan;
};
