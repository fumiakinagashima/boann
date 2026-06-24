// 「新しいチャット」クリック時にチャット画面の状態をリセットするための合図
// +page.svelte はクライアント側インメモリ状態を保持するため、同じ "/" への遷移では
// SvelteKitがコンポーネントインスタンスを再利用し自動リセットされない
class ChatSessionStore {
	resetToken = $state(0);

	startNew() {
		this.resetToken++;
	}
}

export const chatSession = new ChatSessionStore();
