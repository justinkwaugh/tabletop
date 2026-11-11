import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.post('/daily', async () => {
        const runId = await fastify.siteStatsService.startDailyRollup()
        return { status: 'ok', payload: { runId } }
    })
}
