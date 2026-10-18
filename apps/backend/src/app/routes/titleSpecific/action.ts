import { FastifyInstance } from 'fastify'
import { TSchema, Type, type Static } from 'typebox'
import { GameAction, ActionSource, GameDefinition, ToAPIAction } from '@tabletop/common'
import * as Value from 'typebox/value'
import { InvalidActionError } from '../../lib/errors.js'
import { actionAjvOptions } from '../../../runtime/ajvOptions.js'
import { lazyValidatorCompiler } from '../../../runtime/lazyValidation.js'

export default async function (
    definition: GameDefinition,
    actionType: string,
    actionSchema: TSchema,
    fastify: FastifyInstance
) {
    type ActionRequest = Static<typeof ActionRequest>
    const ActionRequest = Type.Object(
        {
            gameId: Type.String(),
            action: ToAPIAction(actionSchema)
        },
        { additionalProperties: false }
    )

    fastify.post<{ Body: ActionRequest }>(
        `/action/${actionType}`,
        {
            config: { requestTiming: true },
            schema: {
                body: ActionRequest
            },
            validatorCompiler: lazyValidatorCompiler(() => fastify.getSchemas(), actionAjvOptions),
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
                const [error] = Value.Errors(actionSchema, action)
                throw new InvalidActionError({
                    actionType,
                    problem: `${error.instancePath} ${error.message}`
                })
            }
            if (action.gameId !== request.body.gameId) {
                throw new InvalidActionError({
                    actionType,
                    problem: 'the Action is for a different game'
                })
            }

            const representation = await fastify.gameService.applyActionToGame({
                definition,
                action,
                user
            })

            return {
                status: 'ok',
                payload: representation
            }
        }
    )
}
