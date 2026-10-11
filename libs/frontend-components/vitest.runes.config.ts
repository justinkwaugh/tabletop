import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineProject } from 'vitest/config'

// Rune effects only run when compiled for the client, so these specs run apart from the node-mode suite.
export default defineProject({
    plugins: [svelte({ hot: false })],
    resolve: {
        conditions: ['browser'],
        alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
    },
    test: {
        name: 'frontend-components-runes',
        include: ['src/**/*.client.spec.ts'],
        environment: '../../config/config-vitest/clientRunesEnvironment.ts'
    }
})
