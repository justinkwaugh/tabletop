import { resolveTitle, type TitleDefinition } from '../../lib/titleDefinition.js'
import * as Value from 'typebox/value'
import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { Game, createGameRequestSchema, GameConfig } from '@tabletop/common'

export default async function (source: TitleDefinition, fastify: FastifyInstance) {
    type CreateGameRequest = Static<typeof CreateGameRequest>
    const CreateGameRequest = createGameRequestSchema(
        typeof source === 'function' ? Type.Unknown() : source.info.configurator?.schema
    )

    fastify.post<{ Body: CreateGameRequest }>(
        `/create`,
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: CreateGameRequest },
            preValidation:
                typeof source === 'function'
                    ? async (request) => {
                          fastify.titleValidation.validate(
                              resolveTitle(source, request),
                              'create',
                              request.body
                          )
                      }
                    : undefined,
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            const definition = resolveTitle(source, request)
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const { config, ...fields } = request.body.game
            if (config !== undefined) Value.Assert(GameConfig, config)
            const game: Partial<Game> = { ...fields, config }
            game.typeId = definition.info.id

            const newGame = await fastify.gameService.createGame({
                definition,
                game,
                owner: request.user,
                options: request.body.options
            })
            return { status: 'ok', payload: { game: newGame } }
        }
    )
}
