import { sveltekit } from '@sveltejs/kit/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// SvelteKit powers the demo app in src/routes (and the e2e tests against it).
	plugins: [sveltekit()],
	test: {
		projects: [
			{
				extends: false,
				plugins: [svelte()],
				resolve: { conditions: ['browser'] },
				optimizeDeps: { include: ['@urql/core', 'wonka', 'esm-env', 'gql.tada'] },
				test: {
					name: 'unit',
					root: import.meta.dirname,
					include: ['tests/**/*.test.ts'],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }]
					}
				}
			}
		]
	}
});
