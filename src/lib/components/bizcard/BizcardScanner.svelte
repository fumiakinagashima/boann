<script lang="ts">
	import type { BizcardResult } from '../../../routes/api/bizcard/+server';
	import CameraScanner from './CameraScanner.svelte';

	type State = 'idle' | 'loading' | 'done' | 'error';

	type Props = {
		onRegister?: (result: BizcardResult, mode: 'both' | 'existing') => void;
	};

	let { onRegister }: Props = $props();

	let scanState = $state<State>('idle');
	let errorMsg = $state('');
	let results = $state<BizcardResult[]>([]);
	let previewUrl = $state<string | null>(null);
	let scanResetSignal = $state(0);

	const fields: { key: keyof BizcardResult; label: string; icon: string }[] = [
		{ key: 'name',    label: '氏名',     icon: 'M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z' },
		{ key: 'company', label: '会社名',   icon: 'M4 4h16v2H4zm0 4h16v2H4zm0 4h10v2H4zm0 4h10v2H4zm12 0h4v6h-4zm1 1v4h2v-4z' },
		{ key: 'title',   label: '役職',     icon: 'M20 7H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-9 8H5v-2h6v2zm4-4H5V9h10v2zm3 4h-2v-2h2v2z' },
		{ key: 'email',   label: 'メール',   icon: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z' },
		{ key: 'phone',   label: '電話',     icon: 'M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z' },
		{ key: 'address', label: '住所',     icon: 'M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5c-1.4 0-2.5-1.1-2.5-2.5S10.6 6.5 12 6.5s2.5 1.1 2.5 2.5S13.4 11.5 12 11.5z' },
		{ key: 'website', label: 'Web',      icon: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1 17.9c-3.9-.5-7-3.9-7-7.9 0-.6.1-1.2.2-1.8L9 15v1c0 1.1.9 2 2 2v1.9zm6.9-2.6c-.3-.8-1-1.3-1.9-1.3h-1v-3c0-.6-.4-1-1-1H8v-2h2c.6 0 1-.4 1-1V7h2c1.1 0 2-.9 2-2v-.4c2.9 1.2 5 4 5 7.4 0 2.1-.8 4-2.1 5.3z' }
	];

	async function upload(blob: Blob) {
		scanState = 'loading';
		results = [];
		errorMsg = '';

		const fd = new FormData();
		fd.append('image', blob, 'bizcard.jpg');

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 25000);

		try {
			const res = await fetch('/api/bizcard', { method: 'POST', body: fd, signal: controller.signal });
			clearTimeout(timer);
			const data = await res.json() as { results?: BizcardResult[]; error?: string };
			if (!res.ok || data.error) {
				scanState = 'error';
				errorMsg = data.error ?? '抽出に失敗しました。';
			} else {
				results = data.results ?? [];
				scanState = 'done';
			}
		} catch (e) {
			clearTimeout(timer);
			scanState = 'error';
			errorMsg = e instanceof Error && e.name === 'AbortError'
				? 'タイムアウトしました。画像を小さくして再試行してください。'
				: 'ネットワークエラーが発生しました。';
		}
	}

	function reset() {
		scanState = 'idle';
		results = [];
		errorMsg = '';
		if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
		scanResetSignal += 1;
	}

	function handleCameraCapture(blob: Blob) {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = URL.createObjectURL(blob);
		upload(blob);
	}

	function registerUrl(r: BizcardResult): string {
		const p = new URLSearchParams();
		if (r.company) p.set('name', r.company);
		else if (r.name) p.set('name', r.name);
		if (r.email)   p.set('email', r.email);
		if (r.phone)   p.set('phone', r.phone);
		if (r.address) p.set('address', r.address);
		if (r.website) p.set('website', r.website);
		const notes: string[] = [];
		if (r.name) notes.push(`担当者: ${r.name}${r.title ? `（${r.title}）` : ''}`);
		if (notes.length) p.set('notes', notes.join('\n'));
		return `/database/customers/new?${p.toString()}`;
	}
</script>

<div class="scanner">
	<div class="capture-area">
		<div class="upload-zone">
			<CameraScanner onCapture={handleCameraCapture} resetSignal={scanResetSignal} />
			{#if previewUrl}
				<div class="capture-overlay">
					<img src={previewUrl} alt="名刺プレビュー" class="preview-img" />
					{#if scanState === 'loading'}
						<div class="overlay">
							<div class="spinner"></div>
							<p>AIが情報を読み取っています…</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Result cards -->
	{#if scanState === 'done' && results.length > 0}
		<div class="results-wrap">
			<div class="result-header">
				<span class="result-badge">{results.length}件 抽出完了</span>
				<button class="reset-btn" onclick={reset}>再スキャンする</button>
			</div>

			<div class="result-cards">
				{#each results as r, i}
					<div class="result-card">
						{#if results.length > 1}
							<p class="card-index">名刺 {i + 1}</p>
						{/if}
						<div class="fields">
							{#each fields as f}
								{#if r[f.key]}
									<div class="field-row">
										<span class="field-icon" aria-hidden="true">
											<svg viewBox="0 0 24 24" fill="currentColor">
												<path d={f.icon}/>
											</svg>
										</span>
										<span class="field-label">{f.label}</span>
										<span class="field-value">{r[f.key]}</span>
									</div>
								{/if}
							{/each}
						</div>
						<div class="actions">
							{#if onRegister}
								<button type="button" class="action-btn primary" onclick={() => onRegister(r, 'both')}>
									顧客・担当者を登録する
								</button>
								<button type="button" class="action-btn secondary" onclick={() => onRegister(r, 'existing')}>
									顧客を選択して担当者を登録する
								</button>
							{:else}
								<a href={registerUrl(r)} class="action-btn primary">顧客として登録</a>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if scanState === 'error'}
		<div class="error-box">
			<p>{errorMsg}</p>
			<button onclick={reset}>閉じる</button>
		</div>
	{/if}
</div>

<style lang="scss">
	.scanner {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.capture-area {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		max-width: 480px;
	}

	.upload-zone {
		max-width: 480px;
		min-height: 220px;
		border-radius: 16px;
		background: var(--color-surface);
		position: relative;
		overflow: hidden;
	}

	.capture-overlay {
		position: absolute;
		inset: 0;
		background: #000;
	}

	.preview-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		max-height: 320px;
	}

	.overlay {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--color-background) 70%, transparent);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;

		p {
			font-size: 0.9375rem;
			color: var(--color-text-muted);
			margin: 0;
		}
	}

	.spinner {
		width: 36px;
		height: 36px;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.results-wrap {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.result-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.result-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		border-radius: 20px;
		padding: 4px 12px;
	}

	.reset-btn {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;

		&:hover { color: var(--color-text); }
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--color-border);
		border-radius: 12px;
		overflow: hidden;
	}

	.field-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);

		&:last-child { border-bottom: none; }
	}

	.field-icon {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		color: var(--color-text-muted);

		svg { width: 18px; height: 18px; }
	}

	.field-label {
		flex-shrink: 0;
		width: 72px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.field-value {
		font-size: 0.9375rem;
		color: var(--color-text);
		word-break: break-all;
	}

	.result-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 16px;
	}

	.result-card {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.card-index {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-muted);
		margin: 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.action-btn {
		display: inline-block;
		padding: 9px 20px;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		border: none;
		cursor: pointer;
		transition: opacity 0.15s;

		&.primary { background: var(--color-primary); color: #fff; }

		&.secondary {
			background: var(--color-surface);
			border: 1px solid var(--color-border);
			color: var(--color-text);
		}

		&:hover { opacity: 0.88; }
	}

	.error-box {
		max-width: 480px;
		background: color-mix(in srgb, var(--color-danger) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
		border-radius: 10px;
		padding: 16px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;

		p {
			margin: 0;
			font-size: 0.9375rem;
			color: var(--color-danger);
		}

		button {
			font-size: 0.875rem;
			background: none;
			border: 1px solid var(--color-danger);
			color: var(--color-danger);
			border-radius: 6px;
			padding: 5px 14px;
			cursor: pointer;
			white-space: nowrap;
		}
	}
</style>
