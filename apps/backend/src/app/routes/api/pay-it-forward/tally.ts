import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get('/tally', async function (_request, reply) {
        const tally = await fastify.charityTallyService.getTally()
        if (!tally) {
            reply.header('Cache-Control', 'no-store')
            return reply.code(404).send()
        }
        reply.header('Cache-Control', 'public, max-age=600')
        return { status: 'ok', payload: tally }
    })
}
