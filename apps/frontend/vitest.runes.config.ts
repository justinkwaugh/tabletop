import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject } from 'vitest/config'

// Rune effects only run when compiled for the client, so these specs run apart from the node-mode suite.
export default defineProject({
    plugins: [sveltekit()],
    resolve: { conditions: ['browser'] },
    test: {
        name: 'frontend-runes',
        include: ['src/**/*.client.spec.ts'],
        environment: '../../config/config-vitest/clientRunesEnvironment.ts'
    }
})
