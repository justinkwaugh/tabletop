import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit(), devtoolsJson()],
        build: {
            commonjsOptions: {
                include: [/node_modules/]
            }
        },
        server: {
            host: true,
            port: 5173,
            watch: {
                usePolling: true,
                interval: 300
            }
        }
    })
)
