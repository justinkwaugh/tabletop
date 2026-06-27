import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit()],
        optimizeDeps: {
            exclude: ['@tabletop/frontend-components']
        },
        build: {
            commonjsOptions: {
                include: [/node_modules/]
            }
        },
        server: {
            host: true,
            port: 5173,
            fs: {
                allow: ['../..']
            }
        }
    })
)
