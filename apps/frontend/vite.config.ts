import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    server: { host: '0.0.0.0', fs: { strict: false } },
    plugins: [sveltekit(), devtoolsJson()],
    test: { include: ['src/**/*.{test,spec}.{js,ts}'] },
    build: {
        commonjsOptions: { include: [/node_modules/] },
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    return 'my-app'
                }
            }
        }
    }
})
