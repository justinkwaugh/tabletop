import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit(), devtoolsJson()],
        // Vite 8 resolves an SSR-externalized CSS @import as a relative file (vitejs/vite#23096).
        ssr: { noExternal: ['tailwindcss'] },
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
