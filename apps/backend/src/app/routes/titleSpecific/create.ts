import type { TitleResolver } from '../../lib/titleDefinition.js'
import * as Value from 'typebox/value'
import { FastifyInstance } from 'fastify'
import type { Static } from 'typebox'
import { Game, createGameRequestSchema, GameConfig } from '@tabletop/common'

// The body shape with an unconstrained config; the pinned generation's configurator schema is
// what the body is validated against.
type CreateGameRequest = Static<ReturnType<typeof createGameRequestSchema>>

export default async function (title: TitleResolver, fastify: FastifyInstance) {
    fastify.post(
        `/create`,
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            preValidation: async (request) => {
                request.body = fastify.titleValidation.request(
                    title(request),
                    'create',
                    request.body
                )
            },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            const definition = title(request)
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const body = request.body as CreateGameRequest
            const { config, ...fields } = body.game
            if (config !== undefined) Value.Assert(GameConfig, config)
            const game: Partial<Game> = { ...fields, config }
            game.typeId = definition.info.id

            const newGame = await fastify.gameService.createGame({
                definition,
                game,
                owner: request.user,
                options: body.options
            })
            return { status: 'ok', payload: { game: newGame } }
        }
    )
}
