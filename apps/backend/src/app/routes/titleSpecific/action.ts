import type { FastifyInstance } from 'fastify'
import * as Value from 'typebox/value'
import { ActionSource } from '@tabletop/common'
import type { TitleResolver } from '../../lib/titleDefinition.js'
import { InvalidActionError } from '../../lib/errors.js'
import { gameActionEnvelope } from '../../../runtime/titleValidation.js'

type ActionRequest = { gameId: string; action: unknown }

export default async function (title: TitleResolver, fastify: FastifyInstance) {
    fastify.post(
        '/action/:actionType',
        {
            config: { requestTiming: true },
            // The body is validated against the pinned generation's schema for this action, so
            // the route needs no schema of its own and a new logic version changes no route.
            preValidation: async (request) => {
                request.body = fastify.titleValidation.request(
                    title(request),
                    `action:${actionType(request)}`,
                    request.body
                )
            },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            const definition = title(request)
            const type = actionType(request)
            const actionSchema = definition.runtime.apiActions[type]
            const validator = fastify.titleValidation.action(definition, type)
            if (!actionSchema || !validator) {
                throw Object.assign(new Error('Not Found'), { statusCode: 404 })
            }
            const user = request.user
            if (!user) {
                throw Error('No user found for create request')
            }

            // The wire form carries dates as strings; the Action the title executes has Dates.
            const body = request.body as ActionRequest
            const action = Value.Convert(actionSchema, body.action)
            if (!gameActionEnvelope.Check(action)) {
                throw new InvalidActionError({
                    actionType: type,
                    problem: 'Invalid Action envelope'
                })
            }
            action.source = ActionSource.User

            if (!validator.Check(action)) {
                const [error] = validator.Errors(action)
                throw new InvalidActionError({
                    actionType: type,
                    problem: error ? `${error.instancePath} ${error.message}` : 'invalid'
                })
            }
            if (action.gameId !== body.gameId) {
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
