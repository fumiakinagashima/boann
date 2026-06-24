<script lang="ts">
	import { onMount, tick } from 'svelte';

	type ScanState = 'init' | 'starting' | 'live' | 'captured' | 'error';

	type Props = {
		onCapture: (blob: Blob) => void;
		resetSignal: number;
	};
	let { onCapture, resetSignal }: Props = $props();

	let scanState = $state<ScanState>('init');
	let statusMsg = $state('');
	let errorMsg = $state('');

	let viewportEl: HTMLDivElement;
	let videoEl: HTMLVideoElement;
	let overlayCanvas: HTMLCanvasElement;

	let stream: MediaStream | null = null;

	const LIVE_STATUS_MSG = 'シャッターボタン（または Space キー）で撮影してください。';

	/** Computes the source rect of `videoEl` visible under `object-fit: cover` for a `containerW x containerH` box. */
	function getCoverCrop(
		videoW: number,
		videoH: number,
		containerW: number,
		containerH: number
	): { sx: number; sy: number; sw: number; sh: number } {
		const videoRatio = videoW / videoH;
		const containerRatio = containerW / containerH;
		if (videoRatio > containerRatio) {
			const sh = videoH;
			const sw = sh * containerRatio;
			return { sx: (videoW - sw) / 2, sy: 0, sw, sh };
		}
		const sw = videoW;
		const sh = sw / containerRatio;
		return { sx: 0, sy: (videoH - sh) / 2, sw, sh };
	}

	/** Crops the cover-fit `cropRect` of the video at native resolution. */
	function captureFullFrame(
		cropRect: { sx: number; sy: number; sw: number; sh: number },
		outputLongEdge = 1600
	): HTMLCanvasElement {
		const scale = Math.min(1, outputLongEdge / Math.max(cropRect.sw, cropRect.sh));
		const outW = Math.max(1, Math.round(cropRect.sw * scale));
		const outH = Math.max(1, Math.round(cropRect.sh * scale));

		const canvas = document.createElement('canvas');
		canvas.width = outW;
		canvas.height = outH;
		canvas
			.getContext('2d')!
			.drawImage(videoEl, cropRect.sx, cropRect.sy, cropRect.sw, cropRect.sh, 0, 0, outW, outH);
		return canvas;
	}

	function drawGuide() {
		const containerW = viewportEl.clientWidth;
		const containerH = viewportEl.clientHeight;
		overlayCanvas.width = containerW;
		overlayCanvas.height = containerH;
		const ctx = overlayCanvas.getContext('2d')!;
		ctx.clearRect(0, 0, containerW, containerH);

		const guideW = containerW * 0.85;
		const guideH = guideW / 1.585;
		const x = (containerW - guideW) / 2;
		const y = (containerH - guideH) / 2;
		ctx.save();
		ctx.setLineDash([10, 8]);
		ctx.lineWidth = 2;
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
		ctx.strokeRect(x, y, guideW, guideH);
		ctx.restore();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.code !== 'Space' || scanState !== 'live') return;
		const tag = (document.activeElement as HTMLElement | null)?.tagName;
		if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
		e.preventDefault();
		manualCapture();
	}

	onMount(() => {
		window.addEventListener('resize', drawGuide);
		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('resize', drawGuide);
			window.removeEventListener('keydown', handleKeydown);
			stream?.getTracks().forEach((t) => t.stop());
			stream = null;
		};
	});

	$effect(() => {
		resetSignal;
		if (scanState === 'captured') {
			scanState = 'live';
			statusMsg = LIVE_STATUS_MSG;
		}
	});

	async function startCamera() {
		scanState = 'starting';
		statusMsg = 'カメラを起動しています…';
		errorMsg = '';
		await tick();

		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: 'environment' } },
				audio: false
			});
			videoEl.srcObject = stream;
			await videoEl.play();
		} catch (e) {
			stream?.getTracks().forEach((t) => t.stop());
			stream = null;
			scanState = 'error';
			const name = e instanceof Error ? e.name : '';
			if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
				errorMsg = 'カメラの使用が許可されていません。';
			} else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
				errorMsg = 'カメラが見つかりません。';
			} else {
				errorMsg = 'カメラの起動に失敗しました。';
			}
			return;
		}

		scanState = 'live';
		statusMsg = LIVE_STATUS_MSG;
		await tick();
		drawGuide();
	}

	function emitCapture(canvas: HTMLCanvasElement) {
		scanState = 'captured';
		canvas.toBlob(
			(blob) => {
				if (blob) {
					onCapture(blob);
				} else {
					scanState = 'live';
				}
			},
			'image/jpeg',
			0.9
		);
	}

	function manualCapture() {
		if (scanState !== 'live' || !videoEl.videoWidth) return;
		try {
			const crop = getCoverCrop(videoEl.videoWidth, videoEl.videoHeight, viewportEl.clientWidth, viewportEl.clientHeight);
			emitCapture(captureFullFrame(crop));
		} catch {
			// ignore, stay live
		}
	}
</script>

<div class="scanner">
	{#if scanState === 'init'}
		<div class="placeholder">
			<button class="primary-btn" onclick={startCamera}>カメラで読み取る</button>
		</div>
	{:else if scanState === 'error'}
		<div class="placeholder">
			<p class="error-text">{errorMsg}</p>
			<button class="primary-btn" onclick={startCamera}>再試行</button>
		</div>
	{/if}

	<div class="viewport" bind:this={viewportEl} class:hidden={scanState === 'init' || scanState === 'error'}>
		<video bind:this={videoEl} playsinline muted autoplay></video>
		<canvas bind:this={overlayCanvas} class="overlay"></canvas>
		{#if statusMsg}
			<p class="status">{statusMsg}</p>
		{/if}
		<button class="shutter" onclick={manualCapture} disabled={scanState !== 'live'} aria-label="撮影"></button>
	</div>
</div>

<style lang="scss">
	.scanner {
		width: 100%;
		height: 100%;
		min-width: 320px;
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		width: 100%;
		height: 100%;
		min-height: 220px;
		padding: 32px;
		text-align: center;
	}

	.error-text {
		font-size: 0.9375rem;
		color: var(--color-danger);
		margin: 0;
	}

	.primary-btn {
		display: inline-block;
		padding: 9px 20px;
		border-radius: 8px;
		background: var(--color-primary);
		color: #fff;
		font-size: 0.875rem;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.primary-btn:hover {
		opacity: 0.88;
	}

	.viewport {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 220px;
		aspect-ratio: 1.585;
		background: #000;
		overflow: hidden;
	}

	.viewport.hidden {
		display: none;
	}

	.viewport video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.status {
		position: absolute;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		margin: 0;
		padding: 6px 16px;
		border-radius: 20px;
		background: color-mix(in srgb, #000 55%, transparent);
		color: #fff;
		font-size: 0.8125rem;
		white-space: nowrap;
	}

	.shutter {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: color-mix(in srgb, #fff 85%, transparent);
		border: 4px solid color-mix(in srgb, #fff 60%, transparent);
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.shutter:hover:not(:disabled) {
		opacity: 0.88;
	}

	.shutter:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
