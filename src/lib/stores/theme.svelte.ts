type Theme = 'light' | 'dark' | 'system';

class ThemeStore {
	value = $state<Theme>(
		(typeof localStorage !== 'undefined' ? (localStorage.getItem('theme') as Theme) : null) ?? 'system'
	);
}

export const themeStore = new ThemeStore();
