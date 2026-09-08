import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit()],
        optimizeDeps: { entries: ['src/lib/model/tests/*.fixture.ts'] },
        build: {
            commonjsOptions: {
                include: [/node_modules/]
            }
        },
        server: {
            port: 5174
        }
    })
)
