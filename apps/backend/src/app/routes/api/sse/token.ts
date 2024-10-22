import { SSEAuthorizationTokenData, TokenType } from '@tabletop/backend-services'
import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get(
        '/token',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw new Error('No user found')
            }

            const token = await fastify.tokenService.createToken<SSEAuthorizationTokenData>({
                type: TokenType.SSEAuthorization,
                data: { userId: request.user.id },
                expiresInSeconds: 30
            })

            return { status: 'ok', payload: { token } }
        }
    )
}
