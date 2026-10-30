import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineProject } from 'vitest/config'
import { projectRoot } from '@tabletop/vitest-config'

// The session's rune classes only react when compiled for the client, so their specs run apart.
export default defineProject({
    root: projectRoot(import.meta.url),
    plugins: [svelte({ hot: false })],
    resolve: {
        conditions: ['browser'],
        alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
    },
    test: {
        name: 'promontory-point-ui-runes',
        include: ['src/**/*.client.svelte.spec.ts'],
        environment: '../../config/config-vitest/clientRunesEnvironment.ts'
    }
})
