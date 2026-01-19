import devtoolsJson from 'vite-plugin-devtools-json'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineProject, mergeConfig } from 'vitest/config'
import { VitestConfig } from '@tabletop/vitest-config'
import type { ClientRequest, IncomingMessage } from 'node:http'

type ProxyServer = {
    on: (event: 'proxyReq', listener: (proxyReq: ClientRequest, req: IncomingMessage) => void) => void
}

export default defineProject(
    mergeConfig(VitestConfig, {
        server: {
            host: '0.0.0.0',
            fs: { strict: false },
            proxy: {
                '/games': {
                    target: 'http://localhost:3000',
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
        assetsInclude: ['**/*.gltf'],
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
