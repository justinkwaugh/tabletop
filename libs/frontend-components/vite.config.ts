import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit()],
        optimizeDeps: {
            entries: ['src/lib/**/tests/*.fixture.ts', 'src/lib/**/tests/*.fixture.svelte.ts']
        },
        server: {
            port: 5174
        }
    })
)
