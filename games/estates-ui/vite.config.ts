import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit()],
        assetsInclude: ['**/*.gltf', '**/*.bin'],
        build: {
            commonjsOptions: {
                include: [/node_modules/]
            }
        },
        server: {
            // Bind every interface rather than loopback alone. Without this vite listens
            // on [::1] only, so a container port forwarded over IPv4 - as VS Code's
            // devcontainer forwarding does - refuses the connection while the server is
            // running perfectly well.
            host: true,
            port: 5173
        }
    })
)
