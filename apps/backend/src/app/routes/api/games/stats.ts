import type { FastifyInstance } from 'fastify'
import { assertExists } from '@tabletop/common'

export default async function (fastify: FastifyInstance) {
    fastify.get(
        '/stats',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async (request) => {
            assertExists(request.user)
            return {
                status: 'ok',
                payload: await fastify.gameService.getGameStatsForUser(request.user)
            }
        }
    )
}
