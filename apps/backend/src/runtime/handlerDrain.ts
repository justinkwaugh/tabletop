import type { FastifyInstance } from 'fastify'

export function installHandlerDrain(server: FastifyInstance): void {
    const pending = new Set<Promise<void>>()
    server.addHook('onRoute', (route) => {
        const handler = route.handler
        route.handler = function (request, reply) {
            const { promise, resolve } = Promise.withResolvers<void>()
            pending.add(promise)
            const finish = () => {
                pending.delete(promise)
                resolve()
            }
            try {
                const result = handler.call(this, request, reply)
                if (
                    result !== null &&
                    (typeof result === 'object' || typeof result === 'function') &&
                    'then' in result &&
                    typeof result.then === 'function'
                ) {
                    void Promise.resolve(result).then(finish, finish)
                } else finish()
                return result
            } catch (error) {
                finish()
                throw error
            }
        }
    })
    server.addHook('preClose', async () => {
        while (pending.size) await Promise.all(pending)
    })
}
