<script lang="ts">
	import Table from '$lib/components/chat/Table.svelte';
	import WorkflowEditorDialog from '$lib/components/dialog/WorkflowEditorDialog.svelte';
	import ActionSelector from '$lib/components/chat/ActionSelector.svelte';
	import Values from '$lib/components/chat/Values.svelte';
	import Kanban from '$lib/components/chat/Kanban.svelte';
	import Link from '$lib/components/chat/Link.svelte';
	import DocumentJob from '$lib/components/chat/DocumentJob.svelte';
	import DocHandoff from '$lib/components/chat/DocHandoff.svelte';
	import FormButton from '$lib/components/chat/FormButton.svelte';
	import Reply from '$lib/components/chat/Reply.svelte';
	import FormDialog from '$lib/components/dialog/FormDialog.svelte';
	import RecordDialog from '$lib/components/dialog/RecordDialog.svelte';
	import TurnHistoryDrawer from '$lib/components/chat/TurnHistoryDrawer.svelte';
	import TypingIndicator from '$lib/components/ui/TypingIndicator.svelte';
	import type { Message, MessageContent, FormContent, ActionItem, ValuesContent, ChartContent, KanbanContent, LinkContent, DocumentJobContent, DocHandoffContent, ReplyContent, WorkflowContent } from '$lib/types/chat';
	import type { StreamEvent } from '$lib/server/ai/stream';
	import * as m from '$lib/paraglide/messages.js';
	import { tick, untrack } from 'svelte';
	import { marked } from 'marked';
	import { filterXSS } from 'xss';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { chatSession } from '$lib/stores/chat-session.svelte';
	import { chatHistory } from '$lib/stores/chat-history.svelte';
	import {
		quickActionCatalog,
		DEFAULT_QUICK_ACTION_IDS,
		MAX_QUICK_ACTIONS,
		QUICK_ACTIONS_STORAGE_KEY,
		isQuickActionId,
		type QuickActionDef
	} from '$lib/quick-actions/catalog';
	import Plus from '$lib/components/icon/Plus.svelte';
	import ArrowUp from '$lib/components/icon/ArrowUp.svelte';
	import Clock from '$lib/components/icon/Clock.svelte';
	import { CHAT_TITLE_MAX_LENGTH, CHAT_TEXTAREA_MAX_HEIGHT_PX } from '$lib/constants';

	function renderMarkdown(text: string): string {
		return filterXSS(marked.parse(text, { async: false }) as string);
	}

	const ls = (key: string, def: string) =>
		typeof localStorage !== 'undefined' ? (localStorage.getItem(key) ?? def) : def;

	function loadQuickActions(): QuickActionDef[] {
		const raw = ls(QUICK_ACTIONS_STORAGE_KEY, '');
		let ids: string[] = DEFAULT_QUICK_ACTION_IDS;
		if (raw) {
			try {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) ids = parsed;
			} catch {
				// ignore malformed value, fall back to defaults
			}
		}
		const valid = ids.filter(isQuickActionId).slice(0, MAX_QUICK_ACTIONS);
		const ordered = valid.length > 0 ? valid : DEFAULT_QUICK_ACTION_IDS;
		return ordered
			.map((id) => quickActionCatalog.find((a) => a.id === id))
			.filter((a): a is QuickActionDef => !!a);
	}

	let { data } = $props();

	function seedMessageFromNotification(seed: { id: string; seedContent: MessageContent[] } | null): Message[] {
		if (!seed) return [];
		return [{ id: crypto.randomUUID(), role: 'assistant', contents: seed.seedContent, createdAt: new Date() }];
	}

	function seedMessagesFromChat(seed: { id: string; messages: { id: string; role: 'user' | 'assistant'; contents: MessageContent[]; createdAt: Date }[] } | null): Message[] {
		if (!seed) return [];
		return seed.messages.map((msg) => ({ id: msg.id, role: msg.role, contents: msg.contents, createdAt: msg.createdAt }));
	}

	let messages = $state<Message[]>(untrack(() =>
		data.seedChat ? seedMessagesFromChat(data.seedChat) : seedMessageFromNotification(data.seedNotification)
	));
	let input = $state('');
	let loading = $state(false);
	let listEl = $state<HTMLElement | null>(null);
	let chatEl = $state<HTMLElement | null>(null);
	let inputWrapEl = $state<HTMLElement | null>(null);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);
	let enterToSend = $state(ls('enterToSend', 'true') !== 'false');
	let hasStarted = $state(untrack(() => !!data.seedNotification || (!!data.seedChat && data.seedChat.messages.length > 0)));
	// 未開始（空のチャット）の入力欄はCSSで中央配置するため初回からそのまま表示（フェードなし）。
	// 既存チャットを開いた場合（seeded）だけ、JSが下部に配置するまで一瞬隠す。
	let inputReady = $state(untrack(() => !hasStarted));
	let currentChatId: string | null = untrack(() => data.seedChat?.id ?? null);
	let quickActions = $state(loadQuickActions());
	let quickActionMenuOpen = $state(false);
	let panelForm = $state<FormContent | null>(null);
	let panelWorkflow = $state<WorkflowContent | null>(null);
	let panelRecord = $state<{ type: string; recordId: string | null; view: 'detail' | 'form'; prefill?: Record<string, string> } | null>(null);
	let historyDrawerOpen = $state(false);

	// entity 属性付きフォームは RecordDialog で開く。entity なし（リマインダー等）は FormDialog。
	function coreToolToPanel(form: FormContent): typeof panelRecord {
		if (!form.entity) return null;
		const prefill: Record<string, string> = {};
		for (const f of form.fields) {
			if (f.key === 'id') continue;
			if (f.value != null && f.value !== '') prefill[f.key] = String(f.value);
		}
		return { type: form.entity, recordId: null, view: 'form', prefill };
	}

	// メッセージを「ユーザー発言1件＋それに続くAI応答群」のターン単位にまとめる。
	// 直前のターンのみをメイン画面に表示し、それ以前は履歴ドロワーに回す。
	type Turn = { id: string; userMsg: Message | null; assistantMsgs: Message[] };
	let turns = $derived.by(() => {
		const result: Turn[] = [];
		let current: Turn | null = null;
		for (const msg of messages) {
			if (msg.role === 'user') {
				current = { id: msg.id, userMsg: msg, assistantMsgs: [] };
				result.push(current);
			} else if (current) {
				current.assistantMsgs.push(msg);
			} else {
				current = { id: msg.id, userMsg: null, assistantMsgs: [msg] };
				result.push(current);
			}
		}
		return result;
	});
	let latestTurn = $derived<Turn | null>(turns.length > 0 ? turns[turns.length - 1] : null);
	let pastTurns = $derived(turns.slice(0, -1));
	let latestTurnMessages = $derived<Message[]>(
		latestTurn ? [...(latestTurn.userMsg ? [latestTurn.userMsg] : []), ...latestTurn.assistantMsgs] : []
	);

	let streamingText = $state('');
	let streamingUIContents = $state<MessageContent[]>([]);

	$effect(() => {
		const handler = (e: StorageEvent) => {
			enterToSend = (localStorage.getItem('enterToSend') ?? 'true') !== 'false';
			if (e.key === QUICK_ACTIONS_STORAGE_KEY || e.key === null) {
				quickActions = loadQuickActions();
			}
		};
		window.addEventListener('storage', handler);
		return () => window.removeEventListener('storage', handler);
	});

	// 通知一覧から ?notification=<id> 付きで遷移してきた場合、その内容をチャットの最初のメッセージとして表示する
	// 初回ロード時は +page.server.ts の load が SSR でシードするため messages/hasStarted の初期値に直接反映済み（ちらつき防止）。
	// この effect は同一ルート内でのクライアントサイド遷移（通知ドロワーから別の通知をクリック）時の追加反映を担う。
	let seededNotificationId: string | null = untrack(() => data.seedNotification?.id ?? null);

	$effect(() => {
		const seed = data.seedNotification;
		if (!seed || seed.id === seededNotificationId) return;
		seededNotificationId = seed.id;
		if (!hasStarted) hasStarted = true;
		messages = [
			...messages,
			{ id: crypto.randomUUID(), role: 'assistant', contents: seed.seedContent, createdAt: new Date() }
		];
	});

	// サイドバー履歴クリック等で `?id=` が変わった場合、その会話を復元する。
	// assignChatId() が発行した自分自身のURL変更（currentChatId と一致）では何もしない。
	$effect(() => {
		const urlChatId = page.url.searchParams.get('id');
		if (urlChatId === currentChatId) return;
		currentChatId = urlChatId;
		messages = seedMessagesFromChat(data.seedChat);
		hasStarted = !!data.seedChat && data.seedChat.messages.length > 0;
		streamingText = '';
		streamingUIContents = [];
		input = '';
	});

	// サイドバーの「新しいチャット」クリック時にチャット状態をリセットする
	// （"/" への遷移はコンポーネントインスタンスを再利用するため自動では戻らない）
	// マウント時点の値を基準に差分を検出する（絶対値チェックだと再マウント時に誤クリアされる）
	let mountedResetToken = chatSession.resetToken;
	$effect(() => {
		const token = chatSession.resetToken;
		if (token === mountedResetToken) return;
		mountedResetToken = token;
		messages = [];
		hasStarted = false;
		streamingText = '';
		streamingUIContents = [];
		seededNotificationId = null;
		input = '';
	});

	// 開いている間だけ document クリックを監視し、メニュー外クリックで閉じる
	// （setTimeout で開いた瞬間のクリックイベントを取りこぼす）
	$effect(() => {
		if (!quickActionMenuOpen) return;
		const close = () => (quickActionMenuOpen = false);
		const id = setTimeout(() => document.addEventListener('click', close), 0);
		return () => {
			clearTimeout(id);
			document.removeEventListener('click', close);
		};
	});

	// Input position management
	function repositionInput(animate: boolean) {
		if (!inputWrapEl) return;
		if (!hasStarted) {
			// 未開始時はCSS（top:50% + translateY(-50%)）で中央寄せ。インラインを消してCSSに委ねる。
			inputWrapEl.style.transition = '';
			inputWrapEl.style.top = '';
			inputWrapEl.style.bottom = '';
			inputWrapEl.style.transform = '';
			return;
		}
		if (!chatEl) return;
		const containerH = chatEl.offsetHeight;
		const inputH = inputWrapEl.offsetHeight;
		// 中央→下部のスライドは top と transform を同時にアニメーションさせて滑らかにする
		inputWrapEl.style.transition = animate
			? 'top 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
			: 'none';
		inputWrapEl.style.transform = 'translateX(-50%)';
		inputWrapEl.style.bottom = 'auto';
		inputWrapEl.style.top = `${containerH - inputH - 24}px`;
	}

	let isFirstEffect = true;
	$effect(() => {
		void hasStarted;
		const animate = !isFirstEffect;
		isFirstEffect = false;
		requestAnimationFrame(() => {
			repositionInput(animate);
			inputReady = true;
		});
	});

	$effect(() => {
		function handleResize() {
			requestAnimationFrame(() => repositionInput(false));
		}
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	function autoGrow() {
		if (!textareaEl) return;
		textareaEl.style.height = 'auto';
		const sh = textareaEl.scrollHeight;
		if (sh >= CHAT_TEXTAREA_MAX_HEIGHT_PX) {
			textareaEl.style.height = `${CHAT_TEXTAREA_MAX_HEIGHT_PX}px`;
			textareaEl.style.overflowY = 'auto';
		} else {
			textareaEl.style.height = sh + 'px';
			textareaEl.style.overflowY = 'hidden';
		}
		requestAnimationFrame(() => repositionInput(false));
	}

	async function scrollLatestToTop() {
		await tick();
		// wait for browser layout pass after DOM update
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		if (!listEl) return;
		const userMsgs = listEl.querySelectorAll('.message.user');
		const last = userMsgs[userMsgs.length - 1] as HTMLElement | undefined;
		if (!last) return;
		const containerTop = listEl.getBoundingClientRect().top;
		const msgTop = last.getBoundingClientRect().top;
		listEl.scrollTo({
			top: Math.max(0, listEl.scrollTop + msgTop - containerTop - 32),
			behavior: 'smooth'
		});
	}

	function addUserMessage(text: string, isFirst = false) {
		const message: Message = { id: crypto.randomUUID(), role: 'user', contents: [{ type: 'text', text }], createdAt: new Date() };
		messages = [...messages, message];
		persistMessage(message, isFirst ? text : undefined);
	}

	// 新規チャット（URLにidも notification も無い状態）で最初のメッセージを送る際、
	// Copilot/Claude.aiのようにチャットIDをURLへ付与する（履歴からの再アクセスを想定）
	function assignChatId() {
		const url = new URL(window.location.href);
		if (url.searchParams.has('id') || url.searchParams.has('notification')) return;
		const id = crypto.randomUUID();
		url.searchParams.set('id', id);
		currentChatId = id;
		goto(`${url.pathname}?${url.searchParams}`, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function chatTitleFrom(text: string): string {
		const t = text.trim().replace(/\s+/g, ' ');
		return t.length > CHAT_TITLE_MAX_LENGTH ? t.slice(0, CHAT_TITLE_MAX_LENGTH) + '…' : t;
	}

	async function persistMessage(message: Message, firstMessageText?: string) {
		if (!currentChatId) return;
		const chatId = currentChatId;
		try {
			await fetch(`/api/chats/${chatId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: message.id,
					role: message.role,
					contents: message.contents,
					...(firstMessageText ? { title: chatTitleFrom(firstMessageText) } : {})
				})
			});
		} catch {
			// 保存失敗時もチャット表示は継続する
		}
		if (firstMessageText) {
			chatHistory.prepend({ id: chatId, title: chatTitleFrom(firstMessageText), updatedAt: new Date().toISOString() });
			requestChatTitle(chatId, firstMessageText);
		}
	}

	async function requestChatTitle(chatId: string, message: string) {
		try {
			const res = await fetch(`/api/chats/${chatId}/title`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message })
			});
			if (!res.ok) return;
			const { title } = (await res.json()) as { title: string };
			if (title) chatHistory.updateTitle(chatId, title);
		} catch {
			// 失敗時は切り詰めタイトルのまま
		}
	}

	function resolveDocumentJob(msg: Message, jobId: string, result: LinkContent) {
		const idx = msg.contents.findIndex((c) => c.type === 'document_job' && c.jobId === jobId);
		if (idx === -1) return;
		msg.contents[idx] = result;
		persistMessage(msg);
	}

	function finalizeStreamingMessage() {
		let nextPanelWorkflow: WorkflowContent | null = null;
		let nextPanelRecord: typeof panelRecord = null;
		const contents: MessageContent[] = [];
		if (streamingText.trim()) contents.push({ type: 'text', text: streamingText });
		for (const c of streamingUIContents) {
			if (c.type === 'form') {
				// フォームはボタンとして描画。ダイアログは自動で開かずユーザーが押して開く。
				contents.push(c);
			} else if (c.type === 'workflow') {
				nextPanelWorkflow = c as WorkflowContent;
			} else {
				contents.push(c);
			}
		}
		if (contents.length === 0 && !nextPanelWorkflow && !nextPanelRecord) {
			contents.push({ type: 'text', text: m.chat_error() });
		}
		if (contents.length > 0) {
			const message: Message = { id: crypto.randomUUID(), role: 'assistant', contents, createdAt: new Date() };
			messages = [...messages, message];
			persistMessage(message);
		}
		if (nextPanelWorkflow) panelWorkflow = nextPanelWorkflow;
		if (nextPanelRecord) panelRecord = nextPanelRecord;
		streamingText = '';
		streamingUIContents = [];
	}

	async function submitToChat(tool: string, data: Record<string, string>) {
		loading = true;
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tool, data, history: messages })
			});
			const result = (await res.json()) as { contents: MessageContent[] };
			const message: Message = { id: crypto.randomUUID(), role: 'assistant', contents: result.contents, createdAt: new Date() };
			messages = [...messages, message];
			persistMessage(message);
		} catch {
			const message: Message = {
				id: crypto.randomUUID(),
				role: 'assistant',
				contents: [{ type: 'text', text: m.chat_error() }],
				createdAt: new Date()
			};
			messages = [...messages, message];
			persistMessage(message);
		} finally {
			loading = false;
		}
	}

	// 削除されたレコードを、同じテーブル種別の一覧テーブルから取り除く
	function removeRecordRow(entity: string, recordId: string) {
		for (const msg of messages) {
			let changed = false;
			for (const content of msg.contents) {
				if (content.type === 'table' && content.entity === entity) {
					const before = content.rows.length;
					content.rows = content.rows.filter((r) => String(r.id) !== recordId);
					if (content.rows.length !== before) changed = true;
				}
			}
			if (changed) persistMessage(msg);
		}
	}

	async function sendMessage(text: string, isFirst = false) {
		addUserMessage(text, isFirst);
		loading = true;
		streamingText = '';
		streamingUIContents = [];
		await scrollLatestToTop();
		repositionInput(false); // recalculate after textarea shrinks back to 1 row

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, history: messages })
			});

			if (!res.ok || !res.body) {
				finalizeStreamingMessage();
				return;
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buf = '';
			let finalized = false;

			const finalize = () => {
				if (finalized) return;
				finalized = true;
				finalizeStreamingMessage();
			};

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buf += decoder.decode(value, { stream: true });
				const parts = buf.split('\n\n');
				buf = parts.pop() ?? '';

				for (const part of parts) {
					const line = part.trim();
					if (!line.startsWith('data: ')) continue;
					try {
						const event = JSON.parse(line.slice(6)) as StreamEvent;
						if (event.type === 'delta') {
							streamingText += event.text;
						} else if (event.type === 'ui') {
							streamingUIContents = [...streamingUIContents, event.content];
						} else if (event.type === 'done') {
							finalize();
						} else if (event.type === 'error') {
							streamingText = m.chat_error();
							finalize();
						}
					} catch {
						// JSON parse error, skip
					}
				}
			}

			finalize();
		} catch {
			streamingText = '';
			messages = [
				...messages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					contents: [{ type: 'text', text: m.chat_error() }],
					createdAt: new Date()
				}
			];
		} finally {
			loading = false;
		}
	}

	async function handleSubmit() {
		const text = input.trim();
		if (!text || loading) return;
		input = '';
		if (textareaEl) textareaEl.style.height = 'auto';
		const isFirst = !hasStarted;
		if (isFirst) {
			hasStarted = true;
			assignChatId();
		}
		await sendMessage(text, isFirst);
	}

	async function handleActionSelect(action: ActionItem) {
		if (loading) return;
		const isFirst = !hasStarted;
		if (isFirst) {
			hasStarted = true;
			assignChatId();
		}
		await sendMessage(action.label, isFirst);
	}

	async function handleReplySubmit(msg: Message, content: ReplyContent, answer: string) {
		if (loading) return;
		const isFirst = !hasStarted;
		if (isFirst) {
			hasStarted = true;
			assignChatId();
		}
		content.completed = true;
		persistMessage(msg);
		await sendMessage(answer, isFirst);
	}

	async function handlePanelSubmit(tool: string, data: Record<string, string>) {
		panelForm = null;
		await submitToChat(tool, data);
	}

	function handlePanelCancel() {
		panelForm = null;
	}

	async function runQuickAction(action: QuickActionDef) {
		quickActionMenuOpen = false;
		if (loading) return;
		const isFirst = !hasStarted;
		if (isFirst) {
			hasStarted = true;
			assignChatId();
		}
		addUserMessage(action.label, isFirst);
		loading = true;
		await scrollLatestToTop();
		try {
			const res = await fetch('/api/quick-actions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: action.id })
			});
			const result = (await res.json()) as { contents: MessageContent[] };
			const formContent = result.contents.find((c) => c.type === 'form') as FormContent | undefined;
			const otherContents = result.contents.filter((c) => c.type !== 'form');
			if (otherContents.length > 0) {
				const message: Message = { id: crypto.randomUUID(), role: 'assistant', contents: otherContents, createdAt: new Date() };
				messages = [...messages, message];
				persistMessage(message);
			}
			if (formContent) {
				const asRecord = coreToolToPanel(formContent);
				if (asRecord) panelRecord = asRecord;
				else panelForm = formContent;
			}
		} catch {
			const message: Message = {
				id: crypto.randomUUID(),
				role: 'assistant',
				contents: [{ type: 'text', text: m.chat_error() }],
				createdAt: new Date()
			};
			messages = [...messages, message];
			persistMessage(message);
		} finally {
			loading = false;
		}
	}

	function handleKey(e: KeyboardEvent) {
		if (enterToSend && e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<div class="chat" bind:this={chatEl}>
	<!-- Greeting: visible only before first message -->
	<div class="greeting" class:hidden={hasStarted} aria-hidden={hasStarted}>
		<h1>BOANN</h1>
		<p>アプリを作成・管理できます</p>
	</div>

	{#if hasStarted && pastTurns.length > 0}
		<button class="history-btn" onclick={() => (historyDrawerOpen = true)} aria-label="会話履歴">
			<Clock size={16} />
		</button>
	{/if}

	<!-- Messages list -->
	<div class="messages" class:visible={hasStarted} bind:this={listEl}>
		<div class="messages-inner">
			{#each latestTurnMessages as msg (msg.id)}
				<div class="message {msg.role}">
					{#if msg.role === 'user'}
						<div class="user-bubble">
							{#each msg.contents as content}
								{#if content.type === 'text'}{content.text}{/if}
							{/each}
						</div>
					{:else}
						<div class="assistant-message">
							{#each (msg.contents as MessageContent[]) as content}
								{#if content.type === 'text'}
									<div class="assistant-text">{@html renderMarkdown(content.text)}</div>
								{:else if content.type === 'form'}
									<FormButton form={content} onclick={() => {
										const asRecord = coreToolToPanel(content);
										if (asRecord) panelRecord = asRecord;
										else panelForm = content;
									}} />
								{:else if content.type === 'table'}
									<Table
										columns={content.columns}
										rows={content.rows}
										onRowClick={content.entity ? (row) => {
										panelRecord = { type: content.entity!, recordId: String(row.id), view: 'detail' };
									} : undefined}
									/>
								{:else if content.type === 'actions'}
									<ActionSelector
										title={content.title}
										actions={content.actions}
										onselect={handleActionSelect}
									/>
								{:else}
									{@const extra = content as ValuesContent | ChartContent | KanbanContent | LinkContent | DocumentJobContent | DocHandoffContent | ReplyContent}
									{#if extra.type === 'values'}
										<Values title={extra.title} items={extra.items} />
									<!-- chart display temporarily disabled -->
									<!-- {:else if extra.type === 'chart'}
										<Chart chartType={extra.chartType} title={extra.title} data={extra.data} /> -->
									{:else if extra.type === 'kanban'}
										{#if !extra.completed}
											<Kanban
												title={extra.title}
												columns={extra.columns}
												cards={extra.cards}
											/>
										{/if}
									{:else if extra.type === 'link'}
										<Link label={extra.label} href={extra.href} description={extra.description} newTab={extra.newTab} />
									{:else if extra.type === 'document_job'}
										<DocumentJob jobId={extra.jobId} label={extra.label} onResolved={(result) => resolveDocumentJob(msg, extra.jobId, result)} />
									{:else if extra.type === 'doc_handoff'}
										<DocHandoff label={extra.label} downloadUrl={extra.downloadUrl} filename={extra.filename} prompt={extra.prompt} />
									{:else if extra.type === 'reply'}
										{#if !extra.completed}
											<Reply
												title={extra.title}
												fields={extra.fields}
												submitLabel={extra.submitLabel}
												onsubmit={(answer) => handleReplySubmit(msg, extra, answer)}
											/>
										{/if}
									{/if}
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/each}

			{#if loading}
				<div class="message assistant">
					<div class="assistant-message">
						<TypingIndicator />
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Floating input card -->
	<div class="input-wrap" bind:this={inputWrapEl} style:opacity={inputReady ? 1 : 0}>
		<div class="input-card">
			<textarea
				bind:this={textareaEl}
				bind:value={input}
				oninput={autoGrow}
				onkeydown={handleKey}
				placeholder={enterToSend ? m.chat_placeholder_enter() : m.chat_placeholder_noenter()}
				rows="1"
				disabled={loading}
			></textarea>
			<div class="input-footer">
				<div class="input-footer-left">
					<div class="quick-action-wrap">
						<button
							class="icon-btn"
							onclick={(e) => {
								e.stopPropagation();
								quickActionMenuOpen = !quickActionMenuOpen;
							}}
							disabled={loading}
							aria-label="クイックアクション"
							aria-expanded={quickActionMenuOpen}
						>
							<Plus size={16} />
						</button>
						{#if quickActionMenuOpen}
							<div class="quick-action-menu">
								{#if quickActions.length === 0}
									<p class="menu-empty">
										クイックアクションが設定されていません。<a href="/settings/quick-actions">設定</a>から追加できます。
									</p>
								{:else}
									{#each quickActions as action}
										<button class="menu-item" onclick={() => runQuickAction(action)}>
											<span class="menu-icon">{action.icon}</span>
											<span class="menu-text">
												<span class="menu-label">{action.label}</span>
												<span class="menu-desc">{action.description}</span>
											</span>
										</button>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
				</div>
				<button
					class="send-btn"
					onclick={handleSubmit}
					disabled={loading || !input.trim()}
					aria-label="送信"
				>
					<ArrowUp size={16} />
				</button>
			</div>
		</div>
	</div>

	{#if panelForm}
		<FormDialog
			form={panelForm}
			onsubmit={handlePanelSubmit}
			oncancel={handlePanelCancel}
		/>
	{/if}
	{#if panelWorkflow}
		<WorkflowEditorDialog
			id={panelWorkflow.id}
			initialName={panelWorkflow.name}
			initialTriggerHour={panelWorkflow.triggerHour}
			initialTriggerMinute={panelWorkflow.triggerMinute}
			initialSteps={panelWorkflow.steps}
			entityTypes={data.entityTypes}
			slackIntegrations={data.slackIntegrations}
			onclose={() => (panelWorkflow = null)}
		/>
	{/if}
	{#if panelRecord}
		<RecordDialog
			type={panelRecord.type}
			recordId={panelRecord.recordId}
			initialView={panelRecord.view}
			prefill={panelRecord.prefill}
			onclose={() => (panelRecord = null)}
			onSaved={() => (panelRecord = null)}
			onDeleted={(id) => {
				const entity = panelRecord?.type;
				panelRecord = null;
				if (entity) removeRecordRow(entity, id);
			}}
		/>
	{/if}
	<TurnHistoryDrawer turns={pastTurns} open={historyDrawerOpen} onclose={() => (historyDrawerOpen = false)} />
</div>

<style lang="scss">
	.chat {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;

	}

	/* ---- Greeting ---- */
	.greeting {
		position: absolute;
		width: 100%;
		left: 0;
		bottom: calc(50% + 100px);
		text-align: center;
		pointer-events: none;
		z-index: 1;
		transition: opacity 0.3s ease;
	}

	.greeting.hidden {
		opacity: 0;
	}

	.greeting h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-primary);
		margin: 0 0 10px;
		letter-spacing: -0.02em;
		font-family: Georgia, 'Times New Roman', Times, serif;
	}

	.greeting p {
		font-size: 1rem;
		color: var(--color-text-muted);
		margin: 0;
	}

	/* ---- History button ---- */
	.history-btn {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 6;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.15s ease, border-color 0.15s ease;
	}

	.history-btn:hover {
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	/* ---- Messages ---- */
	.messages {
		flex: 1;
		min-height: 0; /* flex child must shrink to enable overflow-y scroll */
		overflow-y: auto;
		padding: 48px 0 0;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.35s ease;
		scroll-behavior: smooth;
	}

	.messages.visible {
		opacity: 1;
		pointer-events: auto;
	}

	/* gradient curtain: fades messages into background before the input card */
	.chat::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 200px;
		background: linear-gradient(to bottom, transparent 0%, var(--color-background) 40%);
		pointer-events: none;
		z-index: 5; /* above messages, below input-wrap (z-index 10) */
	}

	.messages-inner {
		max-width: none;
		margin: 0 auto;
		padding: 0 24px 200px;
		display: flex;
		flex-direction: column;
		gap: 28px;
	}

	.message {
		display: flex;
		flex-direction: column;
	}

	/* User messages: quick slide-up */
	.message.user {
		align-items: flex-end;
		animation: fadeSlideUp 0.22s ease-out both;
	}

	@keyframes fadeSlideUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Assistant messages: reveal top → bottom */
	.message.assistant {
		align-items: flex-start;
		animation: revealDown 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
	}

	@keyframes revealDown {
		from {
			clip-path: inset(0 0 100% 0);
			opacity: 0.5;
		}
		to {
			clip-path: inset(0 0 0% 0);
			opacity: 1;
		}
	}

	.user-bubble {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 18px;
		border-bottom-right-radius: 5px;
		padding: 10px 16px;
		max-width: 72%;
		font-size: 0.9375rem;
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--color-text);
	}



	.assistant-message {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.assistant-text {
		font-size: 0.9375rem;
		line-height: 1.75;
		color: var(--color-text);
	}

	/* Markdown inside assistant text */
	.assistant-text :global(p) {
		margin: 0 0 0.6em;
	}
	.assistant-text :global(p:last-child) {
		margin-bottom: 0;
	}
	.assistant-text :global(h1),
	.assistant-text :global(h2),
	.assistant-text :global(h3) {
		font-weight: 600;
		margin: 0.8em 0 0.3em;
		line-height: 1.4;
	}
	.assistant-text :global(h1) {
		font-size: 1.1em;
	}
	.assistant-text :global(h2) {
		font-size: 1.05em;
	}
	.assistant-text :global(h3) {
		font-size: 1em;
	}
	.assistant-text :global(ul),
	.assistant-text :global(ol) {
		padding-left: 1.5em;
		margin: 0.3em 0;
	}
	.assistant-text :global(li) {
		margin: 0.15em 0;
	}
	.assistant-text :global(code) {
		font-family: ui-monospace, monospace;
		font-size: 0.875em;
		background: var(--color-border);
		padding: 0.1em 0.35em;
		border-radius: 3px;
	}
	.assistant-text :global(pre) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 12px 16px;
		overflow-x: auto;
		margin: 0.5em 0;
	}
	.assistant-text :global(pre code) {
		background: none;
		padding: 0;
	}
	.assistant-text :global(strong) {
		font-weight: 600;
	}
	.assistant-text :global(blockquote) {
		border-left: 3px solid var(--color-border);
		margin: 0.5em 0;
		padding-left: 1em;
		color: var(--color-text-muted);
	}
	.assistant-text :global(table) {
		border-collapse: collapse;
		margin: 0.5em 0;
		font-size: 0.9em;
		width: 100%;
	}
	.assistant-text :global(th),
	.assistant-text :global(td) {
		border: 1px solid var(--color-border);
		padding: 6px 12px;
		text-align: left;
	}
	.assistant-text :global(th) {
		background: var(--color-surface);
		font-weight: 600;
	}
	.assistant-text :global(a) {
		color: var(--color-primary);
		text-decoration: underline;
	}

	/* ---- Floating input ---- */
	.input-wrap {
		position: absolute;
		left: 50%;
		/* 未開始時の初期配置はCSSで中央寄せ（JS不要・SSR時点で正位置）。
		   開始後はJS(repositionInput)が top(px)/translateX(-50%) を設定して下部へスライドする。 */
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(720px, calc(100% - 48px));
		z-index: 10;
		pointer-events: none; /* pass scroll events through to messages behind it */
	}

	.input-card {
		pointer-events: auto; /* re-enable for the actual card */
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		box-shadow:
			0 4px 20px rgba(0, 0, 0, 0.06),
			0 1px 4px rgba(0, 0, 0, 0.04);
		padding: 14px 16px 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.input-card textarea {
		width: 100%;
		border: none;
		outline: none;
		background: transparent;
		color: var(--color-text);
		font-size: 0.9375rem;
		font-family: inherit;
		line-height: 1.6;
		resize: none;
		overflow-y: hidden;
		min-height: 26px;
		max-height: 192px; /* matches CHAT_TEXTAREA_MAX_HEIGHT_PX */
		padding: 0;
	}

	.input-card textarea::placeholder {
		color: var(--color-text-muted);
	}

	.input-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.input-footer-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.quick-action-wrap {
		position: relative;
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: transparent;
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			transform 0.15s ease;
	}

	.icon-btn:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}

	.icon-btn:not(:disabled):hover {
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.icon-btn[aria-expanded='true'] {
		color: var(--color-primary);
		border-color: var(--color-primary);
		transform: rotate(45deg);
	}

	.quick-action-menu {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 0;
		min-width: 240px;
		max-width: 300px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.08),
			0 1px 4px rgba(0, 0, 0, 0.04);
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		animation: menuFadeIn 0.15s ease-out;
	}

	@keyframes menuFadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--color-text);
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
		transition: background 0.1s ease;
	}

	.menu-item:hover {
		background: var(--color-background);
	}

	.menu-icon {
		flex-shrink: 0;
		width: 22px;
		font-size: 1.05rem;
		text-align: center;
	}

	.menu-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.menu-label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.menu-desc {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.menu-empty {
		padding: 10px 12px;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		line-height: 1.6;
	}

	.menu-empty a {
		color: var(--color-primary);
	}

	.send-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--color-primary);
		color: #fff;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition:
			opacity 0.15s ease,
			transform 0.15s ease;
	}

	.send-btn:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}

	.send-btn:not(:disabled):hover {
		transform: scale(1.06);
	}

	.send-btn:not(:disabled):active {
		transform: scale(0.94);
	}
</style>
