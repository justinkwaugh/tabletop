import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineProject } from 'vitest/config'

// Rune effects only run when compiled for the client, so these specs run apart from the node-mode suite.
// Uses the plain Svelte plugin rather than sveltekit(), which resets Vite's root to the working
// directory and so breaks this project when Vitest runs from the repo root.
export default defineProject({
    plugins: [svelte({ hot: false })],
    resolve: {
        conditions: ['browser'],
        alias: {
            $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
            '$env/static/public': fileURLToPath(
                new URL('./src/lib/test/sveltekitEnvStaticPublic.ts', import.meta.url)
            ),
            '$app/navigation': fileURLToPath(
                new URL('./src/lib/test/sveltekitAppNavigation.ts', import.meta.url)
            )
        }
    },
    test: {
        name: 'frontend-runes',
        include: ['src/**/*.client.spec.ts'],
        environment: '../../config/config-vitest/clientRunesEnvironment.ts'
    }
})
