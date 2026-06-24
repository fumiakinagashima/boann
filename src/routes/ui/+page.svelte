<script lang="ts">
	import Textbox from '$lib/components/ui/Textbox.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import MultiSelect from '$lib/components/ui/MultiSelect.svelte';
	import SingleSelect from '$lib/components/ui/SingleSelect.svelte';
	import FileUpload from '$lib/components/ui/FileUpload.svelte';
	import Table from '$lib/components/ui/Table.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import List from '$lib/components/ui/List.svelte';
	import BarChart from '$lib/components/ui/BarChart.svelte';
	import LineChart from '$lib/components/ui/LineChart.svelte';
	import PieChart from '$lib/components/ui/PieChart.svelte';
	import ActionSelector from '$lib/components/chat/ActionSelector.svelte';
	import SearchSelect from '$lib/components/ui/SearchSelect.svelte';
	import TimePicker from '$lib/components/ui/TimePicker.svelte';
	import DateTimePicker from '$lib/components/ui/DateTimePicker.svelte';
	import NumberInput from '$lib/components/ui/NumberInput.svelte';
	import DataGrid from '$lib/components/ui/DataGrid.svelte';
	import Kanban from '$lib/components/chat/Kanban.svelte';
	import Chart from '$lib/components/chat/Chart.svelte';
	import TypingIndicator from '$lib/components/ui/TypingIndicator.svelte';
	
	let text = $state('');
	let memo = $state('');
	let status = $state('');
	let toggled = $state(false);
	let date = $state('');
	let tags = $state<string[]>([]);
	let priority = $state('');
	let paginationPage = $state(1);
	let selectedAction = $state('');

	let searchSelectVal = $state('');
	let timeVal = $state('');
	let datetimeVal = $state('');
	let numVal = $state(0);

	let generatingDoc = $state('');
	let docError = $state('');

	async function generateDocument(format: 'docx' | 'xlsx' | 'pptx') {
		generatingDoc = format;
		docError = '';
		try {
			const res = await fetch('/api/documents/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ format })
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error ?? '生成に失敗しました');
			}
			const { href } = (await res.json()) as { href: string };
			window.location.href = href;
		} catch (e) {
			docError = e instanceof Error ? e.message : '生成に失敗しました';
		} finally {
			generatingDoc = '';
		}
	}

	type GridRow = Record<string, string | number | null>;
	let gridRows = $state<GridRow[]>([
		{ name: '山田 太郎', dept: 'sales', age: 32, joined: '2022-04-01' },
		{ name: '鈴木 花子', dept: 'eng', age: 28, joined: '2023-09-15' }
	]);

	const searchOptions = [
		{ value: 'jp', label: '日本' },
		{ value: 'us', label: 'アメリカ' },
		{ value: 'gb', label: 'イギリス' },
		{ value: 'de', label: 'ドイツ' },
		{ value: 'fr', label: 'フランス' },
		{ value: 'cn', label: '中国' },
		{ value: 'kr', label: '韓国' },
		{ value: 'au', label: 'オーストラリア' }
	];

	const gridColumns = [
		{ key: 'name', label: '氏名', width: 160 },
		{ key: 'dept', label: '部署', type: 'select' as const, width: 140, options: [
			{ value: 'sales', label: '営業' },
			{ value: 'eng', label: 'エンジニア' },
			{ value: 'hr', label: '人事' },
			{ value: 'finance', label: '経理' }
		]},
		{ key: 'age', label: '年齢', type: 'number' as const, width: 90 },
		{ key: 'joined', label: '入社日', width: 130 }
	];

	const statusOptions = [
		{ value: 'lead', label: 'リード' },
		{ value: 'active', label: 'アクティブ' },
		{ value: 'inactive', label: '非アクティブ' }
	];

	const tagOptions = [
		{ value: 'vip', label: 'VIP' },
		{ value: 'partner', label: 'パートナー' },
		{ value: 'prospect', label: '見込み' },
		{ value: 'support', label: 'サポート' }
	];

	const priorityOptions = [
		{ value: 'low', label: '低' },
		{ value: 'medium', label: '中' },
		{ value: 'high', label: '高' }
	];

	const tableColumns = [
		{ key: 'name', label: '会社名', sortable: true },
		{ key: 'contact', label: '担当者', sortable: true },
		{ key: 'status', label: 'ステータス' },
		{ key: 'revenue', label: '売上', sortable: true }
	];

	const tableRows = [
		{ name: '株式会社アルコジー', contact: '山田 太郎', status: 'アクティブ', revenue: '¥1,200,000' },
		{ name: '合同会社テスト商事', contact: '鈴木 花子', status: 'リード', revenue: '¥380,000' },
		{ name: 'サンプル株式会社', contact: '佐藤 次郎', status: '非アクティブ', revenue: '¥0' },
		{ name: '株式会社フューチャー', contact: '田中 三郎', status: 'アクティブ', revenue: '¥2,850,000' }
	];

	type Customer = { name: string; contact: string; status: string };
	const listItems: Customer[] = [
		{ name: '株式会社アルコジー', contact: '山田 太郎', status: 'アクティブ' },
		{ name: '合同会社テスト商事', contact: '鈴木 花子', status: 'リード' },
		{ name: 'サンプル株式会社', contact: '佐藤 次郎', status: '非アクティブ' }
	];

	const barData = [
		{ label: '1月', value: 120 },
		{ label: '2月', value: 85 },
		{ label: '3月', value: 200 },
		{ label: '4月', value: 160 },
		{ label: '5月', value: 240 },
		{ label: '6月', value: 195 }
	];

	const lineData = [
		{ label: 'Q1', value: 405 },
		{ label: 'Q2', value: 595 },
		{ label: 'Q3', value: 520 },
		{ label: 'Q4', value: 780 }
	];

	const pieData = [
		{ label: 'アクティブ', value: 58 },
		{ label: 'リード', value: 27 },
		{ label: '非アクティブ', value: 15 }
	];

	const multiBarSeries = [
		{ name: '新規', data: [
			{ label: '1月', value: 45 }, { label: '2月', value: 30 }, { label: '3月', value: 80 },
			{ label: '4月', value: 60 }, { label: '5月', value: 90 }, { label: '6月', value: 70 }
		]},
		{ name: '更新', data: [
			{ label: '1月', value: 75 }, { label: '2月', value: 55 }, { label: '3月', value: 120 },
			{ label: '4月', value: 100 }, { label: '5月', value: 150 }, { label: '6月', value: 125 }
		]}
	];

	const multiLineSeries = [
		{ name: '売上', data: [
			{ label: 'Q1', value: 405 }, { label: 'Q2', value: 595 }, { label: 'Q3', value: 520 }, { label: 'Q4', value: 780 }
		]},
		{ name: '目標', data: [
			{ label: 'Q1', value: 450 }, { label: 'Q2', value: 550 }, { label: 'Q3', value: 600 }, { label: 'Q4', value: 700 }
		]},
		{ name: '前年', data: [
			{ label: 'Q1', value: 320 }, { label: 'Q2', value: 410 }, { label: 'Q3', value: 480 }, { label: 'Q4', value: 560 }
		]}
	];

	const kanbanColumns = [
		{ id: 'prospect', label: '見込み' },
		{ id: 'proposal', label: '提案中' },
		{ id: 'negotiation', label: '交渉中' },
		{ id: 'won', label: '受注' }
	];

	const kanbanCards = [
		{ id: '1', title: '株式会社アルコジー ERPシステム', subtitle: '田中様', amount: 2000000, columnId: 'proposal' },
		{ id: '2', title: '合同会社テスト商事 保守契約', subtitle: '鈴木様', amount: 500000, columnId: 'negotiation' },
		{ id: '3', title: 'サンプル株式会社 初期導入', subtitle: '佐藤様', amount: 800000, columnId: 'prospect' },
		{ id: '4', title: '株式会社フューチャー 追加開発', subtitle: '山本様', amount: 1200000, columnId: 'won' },
		{ id: '5', title: 'テック株式会社 コンサルティング', subtitle: '中村様', amount: 350000, columnId: 'proposal' }
	];
</script>

<div class="page">
	<h1>UI コンポーネント</h1>
	<!-- ローディング-->
	<section>
		<h2>ローディング</h2>
		<div class="grid2">
			<TypingIndicator />
		</div>
	</section>
	
	<!-- フォーム入力 -->
	<section>
		<h2>フォーム入力</h2>
		<div class="grid2">
			<Textbox label="会社名" bind:value={text} placeholder="株式会社..." required />
			<Textbox label="メール" bind:value={text} type="email" placeholder="info@example.com" />
			<Textarea label="メモ" bind:value={memo} placeholder="自由記述..." rows={3} />
			<Select label="ステータス" bind:value={status} options={statusOptions} />
			<DatePicker label="契約日" bind:value={date} />
			<Textbox label="エラー状態" bind:value={text} error="入力してください" />
		</div>
	</section>

	<!-- 選択コントロール -->
	<section>
		<h2>選択コントロール</h2>
		<div class="stack">
			<Toggle label="メール通知を受け取る" bind:checked={toggled} />
			<p class="val">Toggle: {toggled}</p>
			<MultiSelect label="タグ（複数選択）" bind:value={tags} options={tagOptions} />
			<p class="val">選択中: {tags.join(', ') || 'なし'}</p>
			<SingleSelect label="優先度（単一選択）" bind:value={priority} options={priorityOptions} />
			<p class="val">選択中: {priority || 'なし'}</p>
		</div>
	</section>

	<!-- 拡張入力コントロール -->
	<section>
		<h2>拡張入力コントロール</h2>
		<div class="grid2">
			<SearchSelect label="国（検索付きSelect）" bind:value={searchSelectVal} options={searchOptions} />
			<p class="val val-bottom">選択: {searchSelectVal || 'なし'}</p>
			<TimePicker label="時刻" bind:value={timeVal} />
			<DateTimePicker label="日時" bind:value={datetimeVal} />
			<NumberInput label="数量" bind:value={numVal} min={0} max={100} step={5} suffix="個" />
			<p class="val val-bottom">値: {numVal}</p>
		</div>
	</section>

	<!-- データグリッド -->
	<section>
		<h2>データグリッド（スプレッドシート型）</h2>
		<DataGrid bind:rows={gridRows} columns={gridColumns} onchange={(r) => { gridRows = r; }} />
		<p class="val">{gridRows.length} 行</p>
	</section>

	<!-- ファイルアップロード -->
	<section>
		<h2>ファイルアップロード</h2>
		<div class="upload-wrap">
			<FileUpload label="添付ファイル" accept=".pdf,.xlsx,.csv" multiple />
		</div>
	</section>

	<!-- テーブル -->
	<section>
		<h2>テーブル（ソート・ページネーション）</h2>
		<Table columns={tableColumns} rows={tableRows} pageSize={2} />
	</section>

	<!-- ページネーション単体 -->
	<section>
		<h2>ページネーション</h2>
		<div class="stack">
			<Pagination bind:page={paginationPage} totalPages={12} />
			<p class="val">現在のページ: {paginationPage}</p>
		</div>
	</section>

	<!-- リスト -->
	<section>
		<h2>リスト（カード表示）</h2>
		<List items={listItems} columns={3}>
			{#snippet card(c)}
				<p class="card-name">{c.name}</p>
				<p class="card-sub">{c.contact}</p>
				<span class="badge">{c.status}</span>
			{/snippet}
		</List>
	</section>

	<!-- アクション選択 -->
	<section>
		<h2>アクション選択（チャット用TUI）</h2>
		<div class="stack">
			<ActionSelector
				title="次の操作を選択してください"
				actions={[
					{ id: 'create', label: '顧客を登録する', description: '新規顧客情報をフォームで入力します' },
					{ id: 'list', label: '顧客一覧を見る', description: '登録済みの顧客一覧を表示します' },
					{ id: 'report', label: 'レポートを見る', description: '月次の売上レポートを表示します' }
				]}
				onselect={(a) => selectedAction = a.label}
			/>
			{#if selectedAction}<p class="val">選択: {selectedAction}</p>{/if}
		</div>
	</section>

	<!-- グラフ -->
	<section>
		<h2>グラフ</h2>
		<div class="grid2">
			<BarChart title="月別売上（万円）" data={barData} />
			<LineChart title="四半期推移（万円）" data={lineData} color="var(--chart-3)" />
		</div>
		<div class="pie-wrap">
			<PieChart title="顧客ステータス分布" data={pieData} />
		</div>
	</section>

	<!-- 多系列グラフ -->
	<section>
		<h2>グラフ（多系列）</h2>
		<div class="grid2">
			<BarChart title="月別売上 グループ比較" series={multiBarSeries} mode="grouped" />
			<BarChart title="月別売上 積み上げ" series={multiBarSeries} mode="stacked" />
		</div>
		<div class="chart-spacer">
			<LineChart title="四半期推移 複数系列" series={multiLineSeries} />
		</div>
	</section>

	<!-- カンバン -->
	<section>
		<h2>カンバン（AIチャット用）</h2>
		<Kanban title="営業パイプライン" columns={kanbanColumns} cards={kanbanCards} />
	</section>

	<!-- チャート（チャット用ラッパー） -->
	<section>
		<h2>チャート（AIチャット用ラッパー）</h2>
		<div class="stack">
			<Chart chartType="bar" title="月別売上（万円）" data={barData} />
			<Chart chartType="line" title="四半期推移（万円）" data={lineData} />
			<Chart chartType="pie" title="顧客ステータス分布" data={pieData} />
		</div>
	</section>

	<!-- 資料生成 -->
	<section>
		<h2>資料生成（Word / Excel / PowerPoint）</h2>
		<div class="stack">
			<div class="row">
				<button class="btn-primary" onclick={() => generateDocument('docx')} disabled={!!generatingDoc}>
					{generatingDoc === 'docx' ? '生成中...' : 'Word生成'}
				</button>
				<button class="btn-primary" onclick={() => generateDocument('xlsx')} disabled={!!generatingDoc}>
					{generatingDoc === 'xlsx' ? '生成中...' : 'Excel生成'}
				</button>
				<button class="btn-primary" onclick={() => generateDocument('pptx')} disabled={!!generatingDoc}>
					{generatingDoc === 'pptx' ? '生成中...' : 'PowerPoint生成'}
				</button>
			</div>
			{#if docError}<p class="val error">{docError}</p>{/if}
		</div>
	</section>
</div>

<style lang="scss">
	.page {
		padding: 32px 40px;
		max-width: 960px;
		display: flex;
		flex-direction: column;
		gap: 48px;
	}
	h1 {
		font-size: 1.5rem;
		font-weight: 700;
	}
	section { display: flex; flex-direction: column; gap: 16px; }
	h2 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text-muted);
		padding-bottom: 8px;
		border-bottom: 1px solid var(--color-border);
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}
	.stack { display: flex; flex-direction: column; gap: 12px; }
	.row { display: flex; gap: 12px; }
	.val { font-size: 0.8125rem; color: var(--color-text-muted); }
	.val.error { color: var(--color-danger); }
	.val-bottom { align-self: end; padding-bottom: 10px; }
	.upload-wrap { max-width: 480px; }
	.pie-wrap { max-width: 420px; margin-top: 24px; }
	.chart-spacer { margin-top: 24px; }
	.btn-primary {
		padding: 7px 14px;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
	}
	.btn-primary:disabled { opacity: 0.6; cursor: default; }
	.btn-primary:hover:not(:disabled) { opacity: 0.9; }
	.card-name { font-weight: 600; margin-bottom: 4px; }
	.card-sub { font-size: 0.875rem; color: var(--color-text-muted); margin-bottom: 8px; }
	.badge {
		display: inline-block;
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 12px;
		background: var(--color-border);
		color: var(--color-text-muted);
	}
</style>
