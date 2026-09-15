import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { WORKFLOW_REVIEW_SYSTEM_PROMPT, buildWorkflowReviewPrompt } from '$lib/server/ai/prompt';
import type { WorkflowStep } from '$lib/types/chat';

export type WorkflowReviewResult = {
	summary: string;
	issues: string[];
	suggestions: string[];
};

export const POST: RequestHandler = async ({ request, platform }) => {
	const apiKey = platform?.env?.ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY ?? '';
	if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not set.' }, { status: 500 });

	const body = (await request.json()) as {
		name?: string;
		triggerType?: 'schedule' | 'event' | 'mcp_tool';
		triggerHour?: number;
		triggerMinute?: number;
		triggerEvent?: 'create' | 'update' | 'delete' | null;
		triggerEntityTypeId?: string | null;
		inputSchema?: { key: string; label: string; type: string; required?: boolean }[];
		steps?: WorkflowStep[];
	};
	if (!body.steps || body.steps.length === 0) {
		return json({ error: 'There are no steps.' }, { status: 400 });
	}

	const anthropic = new Anthropic({ apiKey, timeout: 30000 });
	let text = '';
	try {
		const message = await anthropic.messages.create({
			model: 'claude-haiku-4-5-20251001',
			max_tokens: 1024,
			system: WORKFLOW_REVIEW_SYSTEM_PROMPT,
			messages: [
				{
					role: 'user',
					content: buildWorkflowReviewPrompt({
						name: body.name ?? '',
						triggerType: body.triggerType,
						triggerHour: body.triggerHour ?? 9,
						triggerMinute: body.triggerMinute ?? 0,
						triggerEvent: body.triggerEvent,
						triggerEntityTypeId: body.triggerEntityTypeId,
						inputSchema: body.inputSchema,
						steps: body.steps
					})
				}
			]
		});
		text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({ error: `AI error: ${msg}` }, { status: 500 });
	}

	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) {
		return json({ error: `Failed to parse the review result. (response: ${text.slice(0, 100)})` }, { status: 500 });
	}

	try {
		const result = JSON.parse(jsonMatch[0]) as WorkflowReviewResult;
		return json(result);
	} catch {
		return json({ error: 'Failed to parse the review result.' }, { status: 500 });
	}
};
