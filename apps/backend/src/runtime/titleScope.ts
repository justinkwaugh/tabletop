import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { TitleScope } from '@tabletop/backend-services'
import { observeHandler } from './observeHandler.js'

export function installTitleScope(server: FastifyInstance): void {
    const requests = new WeakMap<
        FastifyRequest,
        {
            scope: TitleScope
            running: boolean
            responded: boolean
        }
    >()
    server.addHook('onRequest', (request, reply, done) => {
        const scope = server.libraryService.createScope()
        const entry = { scope, running: false, responded: false }
        requests.set(request, entry)
        reply.raw.once('close', () => {
            entry.responded = true
            if (!entry.running) server.libraryService.releaseScope(scope)
        })
        server.libraryService.runInScope(scope, done)
    })
    server.addHook('onRoute', (route) => {
        route.handler = observeHandler(route.handler, (request) => {
            const entry = requests.get(request)
            if (!entry) throw new Error('Missing title request scope')
            entry.running = true
            return () => {
                entry.running = false
                if (entry.responded) server.libraryService.releaseScope(entry.scope)
            }
        })
    })
    server.addHook('onResponse', async (request) => {
        const entry = requests.get(request)
        if (entry) {
            entry.responded = true
            if (!entry.running) server.libraryService.releaseScope(entry.scope)
        }
    })
}
