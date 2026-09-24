import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

// Unit tests use the plain Svelte plugin rather than sveltekit(): SvelteKit resets Vite's root
// to the working directory, which breaks this project when Vitest runs from the repo root.
export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [svelte()],
        test: { exclude: ['**/*.client.spec.ts'] },
        resolve: {
            alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
        }
    })
)
