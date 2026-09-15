import { json } from '@sveltejs/kit';

export function apiError(message: string, status: number, code?: string): Response {
	return json({ error: message, ...(code ? { code } : {}) }, { status });
}

export const errors = {
	badRequest: (msg: string) => apiError(msg, 400, 'BAD_REQUEST'),
	forbidden: (msg = 'You do not have permission to access this') => apiError(msg, 403, 'FORBIDDEN'),
	notFound: (msg = 'Resource not found') => apiError(msg, 404, 'NOT_FOUND'),
	tooManyRequests: (retryAfter: number) =>
		new Response(
			JSON.stringify({
				error: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
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
		apiError(e instanceof Error ? e.message : String(e ?? 'An internal error occurred'), 500, 'INTERNAL_ERROR')
};
