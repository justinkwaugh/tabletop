import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get('/tally', async function (_request, reply) {
        const tally = await fastify.charityTallyService.getTally()
        if (!tally) {
            return reply.code(404).send()
        }
        reply.header('Cache-Control', 'public, max-age=600')
        return { status: 'ok', payload: tally }
    })
}
