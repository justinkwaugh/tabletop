import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'
import type { ClientRequest, IncomingMessage } from 'node:http'

type ProxyServer = {
    on: (
        event: 'proxyReq',
        listener: (proxyReq: ClientRequest, req: IncomingMessage) => void
    ) => void
}

export default defineProject(
    mergeConfig(VitestConfig, {
        server: {
            host: '0.0.0.0',
            port: Number(process.env.LOCAL_HOSTED_FRONTEND_PORT ?? 5173),
            strictPort: Boolean(process.env.LOCAL_HOSTED_FRONTEND_PORT),
            fs: { strict: false },
            proxy: {
                '/api': {
                    target: 'http://127.0.0.1:3000',
                    changeOrigin: true
                },
                '/games': {
                    target: process.env.PUBLIC_API_HOST ?? 'http://127.0.0.1:3000',
                    changeOrigin: true,
                    configure: (proxy: ProxyServer) => {
                        proxy.on('proxyReq', (proxyReq: ClientRequest, req: IncomingMessage) => {
                            const acceptEncoding = req.headers['accept-encoding']
                            if (!acceptEncoding) {
                                return
                            }

                            const headerValue = Array.isArray(acceptEncoding)
                                ? acceptEncoding.join(', ')
                                : acceptEncoding
                            proxyReq.setHeader('accept-encoding', headerValue)
                        })
                    }
                }
            }
        },
        plugins: [sveltekit(), devtoolsJson()],
        // Vite 8 resolves an SSR-externalized CSS @import as a relative file (vitejs/vite#23096).
        ssr: { noExternal: ['tailwindcss'] },
        test: { exclude: ['**/*.client.spec.ts'] },
        assetsInclude: ['**/*.gltf'],
        build: {
            // Vite 7's default targets: Vite 8's would drop media-range lowering (Safari < 16.4)
            // and hex fallbacks for lab() colours (Firefox < 113).
            target: ['chrome107', 'edge107', 'firefox104', 'safari16'],
            rolldownOptions: {
                output: {
                    codeSplitting: { groups: [{ name: 'my-app' }] }
                }
            }
        }
    })
)
