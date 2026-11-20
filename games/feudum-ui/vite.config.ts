import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit(), devtoolsJson()],
        server: {
            // Without it vite binds [::1] alone, which a port forwarded over IPv4 can't reach.
            host: true,
            port: 5173
        }
    })
)
