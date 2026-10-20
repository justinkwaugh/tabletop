import { resolveTitle, type TitleDefinition } from '../../lib/titleDefinition.js'
import { FastifyInstance } from 'fastify'
import { TSchema, Type, type Static } from 'typebox'
import { GameAction, ActionSource, actionRequestSchema } from '@tabletop/common'
import * as Value from 'typebox/value'
import { InvalidActionError } from '../../lib/errors.js'
import { actionAjvOptions } from '../../../runtime/ajvOptions.js'
import { lazyValidatorCompiler } from '../../../runtime/lazyValidation.js'

export default async function (
    source: TitleDefinition,
    registeredActionType: string | undefined,
    registeredActionSchema: TSchema | undefined,
    fastify: FastifyInstance
) {
    type ActionRequest = Static<typeof ActionRequest>
    const ActionRequest = registeredActionSchema
        ? actionRequestSchema(registeredActionSchema)
        : Type.Object(
              { gameId: Type.String(), action: Type.Unknown() },
              { additionalProperties: false }
          )

    fastify.post<{ Body: ActionRequest }>(
        `/action/${registeredActionType ?? ':actionType'}`,
        {
            config: { requestTiming: true },
            preValidation: registeredActionSchema
                ? undefined
                : async (request) => {
                      const type = actionType(request)
                      fastify.titleValidation.validate(
                          resolveTitle(source, request),
                          `action:${type}`,
                          request.body
                      )
                  },
            schema: {
                body: ActionRequest
            },
            validatorCompiler: lazyValidatorCompiler(() => fastify.getSchemas(), actionAjvOptions),
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            const definition = resolveTitle(source, request)
            const type = registeredActionType ?? actionType(request)
            const actionSchema = registeredActionSchema ?? definition.runtime.apiActions[type]
            if (!actionSchema) throw Object.assign(new Error('Not Found'), { statusCode: 404 })
            const user = request.user
            if (!user) {
                throw Error('No user found for create request')
            }

            // convert dates
            const action = Value.Convert(actionSchema, request.body.action)
            if (!Value.Check(GameAction, action)) {
                throw new InvalidActionError({
                    actionType: type,
                    problem: 'Invalid Action envelope'
                })
            }
            action.source = ActionSource.User

            if (!Value.Check(actionSchema, action)) {
                const [error] = Value.Errors(actionSchema, action)
                throw new InvalidActionError({
                    actionType: type,
                    problem: `${error.instancePath} ${error.message}`
                })
            }
            if (action.gameId !== request.body.gameId) {
                throw new InvalidActionError({
                    actionType: type,
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

function actionType(request: { params: unknown }): string {
    const params = request.params
    if (
        typeof params === 'object' &&
        params !== null &&
        'actionType' in params &&
        typeof params.actionType === 'string'
    ) {
        return params.actionType
    }
    throw new Error('Missing Action type')
}
