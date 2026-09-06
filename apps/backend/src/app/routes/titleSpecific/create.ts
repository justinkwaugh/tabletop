import * as Value from 'typebox/value'
import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { Game, GameDefinition, GameCreationOptions, GameConfig } from '@tabletop/common'

export default async function (definition: GameDefinition, fastify: FastifyInstance) {
    type CreateGameRequest = Static<typeof CreateGameRequest>
    const CreateGameRequest = Type.Object(
        {
            options: Type.Optional(GameCreationOptions),
            game: Type.Evaluate(
                Type.Intersect([
                    Type.Pick(Game, ['id', 'name', 'players', 'isPublic', 'seed']),
                    Type.Object({
                        config: Type.Optional(
                            definition.info.configurator?.schema ?? Type.Object({})
                        )
                    })
                ])
            )
        },
        { additionalProperties: false }
    )

    fastify.post<{ Body: CreateGameRequest }>(
        `/create`,
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: CreateGameRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
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
