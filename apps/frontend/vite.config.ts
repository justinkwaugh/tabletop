import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        server: { host: '0.0.0.0', fs: { strict: false } },
        plugins: [sveltekit(), devtoolsJson()],
        build: {
            commonjsOptions: { include: [/node_modules/] },
            rollupOptions: {
                output: {
                    manualChunks: () => {
                        return 'my-app'
                    }
                }
            }
        }
    })
)
