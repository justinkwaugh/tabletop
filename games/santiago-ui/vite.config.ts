import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'
import { harnessScenarioFiles } from '@tabletop/frontend-components/vite/harnessScenarioFiles'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit(), harnessScenarioFiles()],
        optimizeDeps: {
            exclude: ['@tabletop/frontend-components', '@tabletop/santiago']
        },
        build: {
            commonjsOptions: {
                include: [/node_modules/]
            }
        },
        server: {
            host: true,
            port: 5174,
            fs: {
                allow: ['../..']
            }
        }
    })
)
