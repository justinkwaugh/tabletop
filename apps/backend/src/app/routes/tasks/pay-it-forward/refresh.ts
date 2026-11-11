import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.post('/refresh', async function (_request, reply) {
        const refresher = fastify.charityTallyRefresher
        if (!refresher) {
            return reply.code(404).send()
        }
        await refresher.refresh()
        return { status: 'ok' }
    })
}
