import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit()],
        // Vite 8 resolves an SSR-externalized CSS @import as a relative file (vitejs/vite#23096).
        ssr: { noExternal: ['tailwindcss'] },
        optimizeDeps: {
            exclude: ['@tabletop/frontend-components', '@tabletop/santiago']
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
