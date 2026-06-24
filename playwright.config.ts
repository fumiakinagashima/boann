import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	webServer: {
		command: 'bun run dev -- --port 8700',
		port: 8700,
		reuseExistingServer: !process.env.CI
	},
	use: {
		baseURL: 'http://localhost:8700'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
