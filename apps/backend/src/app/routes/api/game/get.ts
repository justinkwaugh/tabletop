import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'

type ParamsType = Static<typeof ParamsType>
const ParamsType = Type.Object({
    gameId: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: ParamsType }>(
        '/get/:gameId',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            if (!request.user) {
                throw Error('No user found for token request')
            }

            const { gameId } = request.params

            const game = await fastify.gameService.getGame({ gameId, withState: true })

            if (!game) {
                await reply.code(404).send()
                return
            }

            const actions = await fastify.gameService.getActionsForGame(game.id)

            // For transitioning to undo
            if (game.state && game.state.actionChecksum === undefined) {
                console.log('Game state has no checksum, calculating...')
                const checksum = await fastify.gameService.backfillChecksum(game.state, actions)
                game.state.actionChecksum = checksum
            }

            return { status: 'ok', payload: { game, actions } }
        }
    )
}
