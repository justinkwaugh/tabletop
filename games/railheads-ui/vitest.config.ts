import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

// Unit tests use the plain Svelte plugin rather than sveltekit(): SvelteKit resets Vite's root
// to the working directory, which breaks this project when Vitest runs from the repo root.
// The session's rune classes only react when compiled for the client.
export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [svelte({ hot: false })],
        resolve: {
            conditions: ['browser'],
            alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
        },
        test: {
            environment: fileURLToPath(
                new URL('../../config/config-vitest/clientRunesEnvironment.ts', import.meta.url)
            )
        }
    })
)
