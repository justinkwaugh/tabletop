import type { FastifyInstance } from 'fastify'
import { observeHandler } from './observeHandler.js'

export function installHandlerDrain(server: FastifyInstance): void {
    const pending = new Set<Promise<void>>()
    server.addHook('onRoute', (route) => {
        route.handler = observeHandler(route.handler, () => {
            const { promise, resolve } = Promise.withResolvers<void>()
            pending.add(promise)
            return () => {
                pending.delete(promise)
                resolve()
            }
        })
    })
    server.addHook('preClose', async () => {
        while (pending.size) await Promise.all(pending)
    })
}
