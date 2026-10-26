import type { FastifyInstance } from 'fastify'
import { StalledGameTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    // Run daily by Cloud Scheduler.
    fastify.post('/sweepStalled', async () => {
        const payload = await fastify.stalledGames.sweep()
        return { status: 'ok', payload }
    })

    fastify.post<{ Body: StalledGameTask }>(
        '/endStalled',
        { schema: { body: StalledGameTask } },
        async (request) => {
            const ended = await fastify.stalledGames.end(request.body)
            return { status: 'ok', payload: { ended } }
        }
    )
}
