import { json } from '@sveltejs/kit';

export function apiError(message: string, status: number, code?: string): Response {
	return json({ error: message, ...(code ? { code } : {}) }, { status });
}

export const errors = {
	badRequest: (msg: string) => apiError(msg, 400, 'BAD_REQUEST'),
	forbidden: (msg = 'アクセス権限がありません') => apiError(msg, 403, 'FORBIDDEN'),
	notFound: (msg = 'リソースが見つかりません') => apiError(msg, 404, 'NOT_FOUND'),
	tooManyRequests: (retryAfter: number) =>
		new Response(
			JSON.stringify({
				error: `レート制限を超えました。${retryAfter}秒後に再試行してください。`,
				code: 'RATE_LIMITED'
			}),
			{
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': String(retryAfter)
				}
			}
		),
	serviceUnavailable: (msg: string) => apiError(msg, 503, 'SERVICE_UNAVAILABLE'),
	internal: (e?: unknown) =>
		apiError(e instanceof Error ? e.message : String(e ?? '内部エラーが発生しました'), 500, 'INTERNAL_ERROR')
};
