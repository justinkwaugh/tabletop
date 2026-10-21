import type { FastifyInstance } from 'fastify'
import { measure } from '@tabletop/backend-services/diagnostics'

// Every request under the given prefixes starts from the current manifest. When the manifest
// selects logic the loaded titles do not match, the request waits for the activation it queued:
// Cloud Run grants an instance CPU only while a request is open, so the load runs inside one
// instead of stalling between them, and every request after the change runs the new logic.
export function installManifestRefresh(server: FastifyInstance, prefixes: string[]): void {
    server.addHook('onRequest', async (request) => {
        const path = request.url.split('?')[0]
        if (!prefixes.some((prefix) => path.startsWith(prefix))) return
        try {
            await measure('manifest.refresh', () => server.libraryService.refreshManifest())
        } catch (error) {
            console.warn('Unable to refresh manifest', error)
            return
        }
        try {
            await measure('manifest.activation', () => server.libraryService.activation())
        } catch {
            // The library reported the failed attempt and keeps the previous titles serving;
            // the request proceeds on them.
        }
    })
}
