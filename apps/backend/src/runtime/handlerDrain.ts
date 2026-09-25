import type { FastifyInstance } from 'fastify'

export function installHandlerDrain(server: FastifyInstance): void {
    const pending = new Set<Promise<void>>()
    server.addHook('onRoute', (route) => {
        const handler = route.handler
        route.handler = async function (request, reply) {
            let finish = () => {}
            const completed = new Promise<void>((resolve) => {
                finish = resolve
            })
            pending.add(completed)
            try {
                return await handler.call(this, request, reply)
            } finally {
                pending.delete(completed)
                finish()
            }
        }
    })
    server.addHook('preClose', async () => {
        while (pending.size) await Promise.all(pending)
    })
}
