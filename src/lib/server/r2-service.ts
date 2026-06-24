export async function uploadR2(
	r2: R2Bucket,
	key: string,
	data: ArrayBuffer | ReadableStream,
	options?: { contentType?: string }
): Promise<void> {
	await r2.put(key, data, {
		httpMetadata: options?.contentType ? { contentType: options.contentType } : undefined
	});
}

export async function getR2(r2: R2Bucket, key: string): Promise<R2ObjectBody | null> {
	return r2.get(key);
}

export async function deleteR2(r2: R2Bucket, key: string): Promise<void> {
	await r2.delete(key);
}
