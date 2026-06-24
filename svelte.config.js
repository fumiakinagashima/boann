import adapter from '@sveltejs/adapter-cloudflare';
import { preprocessor } from './node_modules/@inlang/paraglide-sveltekit/dist/vite/preprocessor/index.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [preprocessor({})],
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			// wrangler.toml's `main` points at our custom src/worker.ts (adds the
			// `scheduled` handler), so use a separate config for the adapter's
			// build step to avoid it overwriting that file.
			config: 'wrangler.build.jsonc',
			platformProxy: {
				enabled: true,
				persist: { path: '.wrangler/state/v3' }
			}
		})
	}
};

export default config;
