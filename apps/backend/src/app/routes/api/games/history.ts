import type { FastifyInstance } from 'fastify'
import { assertExists, GameHistoryQuery, GameHistoryCursor } from '@tabletop/common'
import * as Value from 'typebox/value'

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: GameHistoryQuery }>(
        '/history',
        {
            schema: { querystring: GameHistoryQuery },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async (request, reply) => {
            assertExists(request.user)
            let before: GameHistoryCursor | undefined
            if (request.query.before) {
                try {
                    const value: unknown = JSON.parse(request.query.before)
                    Value.Assert(GameHistoryCursor, value)
                    if (value.time > Date.now()) throw new Error('Future cursor')
                    before = value
                } catch {
                    return reply.code(400).send({
                        status: 'error',
                        error: { name: 'InvalidCursor', message: 'Invalid game history cursor' }
                    })
                }
            }
            return {
                status: 'ok',
                payload: await fastify.gameService.getGameHistoryForUser(request.user, before)
            }
        }
    )
}
