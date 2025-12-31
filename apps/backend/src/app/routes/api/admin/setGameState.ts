import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { GameState } from '@tabletop/common'

export default async function (fastify: FastifyInstance) {
    type SetStateRequest = Static<typeof SetStateRequest>
    const SetStateRequest = Type.Object(
        {
            state: GameState
        },
        { additionalProperties: false }
    )

    fastify.post<{ Body: SetStateRequest }>(
        `/setGameState`,
        {
            schema: {
                body: SetStateRequest
            },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            const user = request.user
            if (!user) {
                throw Error('No user found for create request')
            }

            const state = request.body.state
            await fastify.gameService.setGameState(state)
            return {
                status: 'ok',
                payload: {}
            }
        }
    )
}
