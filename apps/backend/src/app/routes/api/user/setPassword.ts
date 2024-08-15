import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'
import { TokenType, AuthenticationTokenData } from '@tabletop/backend-services'

// While this could be combined into an update user api, for the purposes of resetting
// a password, we cannot require the old password to be provided. Instead we require the
// reset token to be provided along with the new password.

type SetPasswordRequest = Static<typeof SetPasswordRequest>
const SetPasswordRequest = Type.Object(
    {
        password: Type.String(),
        token: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SetPasswordRequest }>(
        '/setPassword',
        {
            schema: { body: SetPasswordRequest },
            onRequest: fastify.auth([fastify.verifyUser])
        },
        async function (request, reply) {
            if (request.user === null || request.user === undefined) {
                throw Error('No user found for create request')
            }

            const { password, token } = request.body

            const tokenData = await fastify.tokenService.getData<AuthenticationTokenData>({
                token,
                expectedType: TokenType.Authentication
            })
            if (!tokenData) {
                await reply.code(401).send()
                return
            }

            if (tokenData.userId !== request.user.id) {
                await reply.code(401).send()
                return
            }

            await fastify.userService.updatePassword(request.user.id, password)

            try {
                await fastify.tokenService.invalidateToken(token)
            } catch {
                fastify.log.error(`Failed to invalidate token ${token}`)
            }

            return { status: 'ok', payload: {} }
        }
    )
}
