import type { RequestHandler } from './$types';
import { getR2, deleteR2 } from '$lib/server/r2-service';
import { errors } from '$lib/server/errors';

export const GET: RequestHandler = async ({ params, url, platform }) => {
	if (!platform?.env?.R2) return errors.serviceUnavailable('R2が設定されていません');

	const obj = await getR2(platform.env.R2, params.id);
	if (!obj) return errors.notFound('ファイルが見つかりません');

	const contentType = obj.httpMetadata?.contentType ?? 'application/octet-stream';
	const filename = url.searchParams.get('filename') ?? params.id;

	return new Response(obj.body, {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
			'Cache-Control': 'private, max-age=3600'
		}
	});
};

export const DELETE: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.R2) return errors.serviceUnavailable('R2が設定されていません');

	await deleteR2(platform.env.R2, params.id);
	return new Response(null, { status: 204 });
};
