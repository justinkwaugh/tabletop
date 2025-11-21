import { FastifyInstance } from 'fastify'
import { TSchema, Type, type Static } from 'typebox'
import { GameAction, ActionSource, GameDefinition, ToAPIAction } from '@tabletop/common'
import { Value } from 'typebox/value'

export default async function (
    definition: GameDefinition,
    actionType: string,
    actionSchema: TSchema,
    fastify: FastifyInstance
) {
    type ActionRequest = Static<typeof ActionRequest>
    const ActionRequest = Type.Object(
        {
            action: ToAPIAction(actionSchema)
        },
        { additionalProperties: false }
    )

    fastify.post<{ Body: ActionRequest }>(
        `/action/${actionType}`,
        {
            schema: {
                body: ActionRequest
            },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            const user = request.user
            if (!user) {
                throw Error('No user found for create request')
            }

            // convert dates
            const action = Value.Convert(actionSchema, request.body.action) as GameAction
            action.source = ActionSource.User // Don't trust client

            if (!Value.Check(actionSchema, action)) {
                throw Error('Invalid action format')
            }

            const { processedActions, updatedGame, missingActions } =
                await fastify.gameService.applyActionToGame({
                    definition,
                    action,
                    user
                })

            // Don't send the state back
            delete updatedGame.state

            return {
                status: 'ok',
                payload: { actions: processedActions, game: updatedGame, missingActions }
            }
        }
    )
}
