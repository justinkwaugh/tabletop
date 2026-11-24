import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig, projectRoot } from '@tabletop/vitest-config'

// sveltekit() resets Vite's root, breaking runs from the repo root; runes react only compiled for the client.
export default defineProject(
    mergeConfig(VitestConfig, {
        root: projectRoot(import.meta.url),
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
