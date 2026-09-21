import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineProject } from 'vitest/config'

// Rune classes only react when compiled for the client, so their specs run apart from the node-mode suite.
export default defineProject({
    plugins: [svelte({ hot: false })],
    resolve: { conditions: ['browser'] },
    test: {
        name: '18xx-ui-runes',
        include: ['src/**/*.svelte.spec.ts'],
        environment: './test/clientRunesEnvironment.ts'
    }
})
