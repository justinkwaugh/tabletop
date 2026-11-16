import type { FastifyInstance } from 'fastify'
import { AbandonedSignUpTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    // Run daily by Cloud Scheduler.
    fastify.post('/sweepAbandonedSignUps', async () => {
        const payload = await fastify.abandonedSignUps.sweep()
        return { status: 'ok', payload }
    })

    fastify.post<{ Body: AbandonedSignUpTask }>(
        '/deleteAbandonedSignUp',
        { schema: { body: AbandonedSignUpTask } },
        async (request) => {
            await fastify.abandonedSignUps.deleteIfAbandoned(request.body)
            return { status: 'ok', payload: {} }
        }
    )
}
