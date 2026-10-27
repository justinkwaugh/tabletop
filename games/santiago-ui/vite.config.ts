import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit()],
        optimizeDeps: {
            exclude: ['@tabletop/frontend-components', '@tabletop/santiago']
        },
        build: {
            // Nothing ships from this harness build; Vite 7's bundled es-module-lexer misreads
            // some minified chunks (#209).
            minify: false,
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
