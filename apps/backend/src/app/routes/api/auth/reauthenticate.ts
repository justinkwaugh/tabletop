import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { passwordAuthenticationBudget } from '../../../lib/operationBudget.js'
import {
    ReauthenticationFailedError,
    reauthenticatedResponse
} from '../../../lib/reauthentication.js'

type PasswordReauthenticationRequest = Static<typeof PasswordReauthenticationRequest>
const PasswordReauthenticationRequest = Type.Object(
    { password: Type.String() },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: PasswordReauthenticationRequest }>(
        '/reauthenticate',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: PasswordReauthenticationRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' }),
            preHandler: passwordAuthenticationBudget(fastify, (request) => {
                if (!request.user?.username) throw new ReauthenticationFailedError()
                return request.user.username
            })
        },
        async function (request) {
            const user = request.user
            if (!user?.username) {
                throw new ReauthenticationFailedError()
            }
            const holder = await fastify.userService.getUserByUsernameAndPassword(
                user.username,
                request.body.password
            )
            if (holder?.id !== user.id) {
                throw new ReauthenticationFailedError()
            }
            return reauthenticatedResponse(fastify, request)
        }
    )
}
