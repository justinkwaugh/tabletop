import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get('/tally', async function (_request, reply) {
        const tallyService = fastify.charityTallyService
        if (!tallyService) {
            return reply.code(404).send()
        }
        const tally = await tallyService.getTally()
        reply.header('Cache-Control', 'public, max-age=600')
        return { status: 'ok', payload: tally }
    })
}
