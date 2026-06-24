import JSZip from 'jszip';

export async function extractZipText(buffer: ArrayBuffer): Promise<string> {
	const zip = await JSZip.loadAsync(buffer);
	const texts = await Promise.all(
		Object.values(zip.files)
			.filter((file) => !file.dir)
			.map((file) => file.async('string'))
	);
	return texts.join('\n');
}
