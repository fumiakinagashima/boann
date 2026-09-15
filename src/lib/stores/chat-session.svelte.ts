// A signal to reset the chat screen's state when "New chat" is clicked.
// +page.svelte holds client-side in-memory state, so navigating to the same "/" reuses the
// SvelteKit component instance instead of resetting it automatically.
class ChatSessionStore {
	resetToken = $state(0);

	startNew() {
		this.resetToken++;
	}
}

export const chatSession = new ChatSessionStore();
