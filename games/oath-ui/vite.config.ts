import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'

export default defineProject(
    mergeConfig(VitestConfig, {
        plugins: [sveltekit(), devtoolsJson()],
        // Containment: Vite's import scan (es-module-lexer) reads `of/` as a regex, and esbuild's
        // renaming names one of Ably's variables `of` in this app's chunk, so the build fails.
        esbuild: { minifyIdentifiers: false },
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
