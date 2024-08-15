import { FastifyInstance } from 'fastify'
import { AuthenticationTokenData, TokenType } from '@tabletop/backend-services'
import { Type, type Static } from '@sinclair/typebox'
import { authSession } from '../../../../lib/session.js'

type TokenLoginRequest = Static<typeof TokenLoginRequest>
const TokenLoginRequest = Type.Object(
    {
        token: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: TokenLoginRequest }>(
        '/login',
        {
            schema: { body: TokenLoginRequest }
        },
        async function (request, reply) {
            const { token } = request.body
            const tokenData = await fastify.tokenService.getData<AuthenticationTokenData>({
                token,
                expectedType: TokenType.Authentication
            })
            if (!tokenData) {
                await reply.code(401).send()
                return
            }

            const user = await fastify.userService.getUser(tokenData.userId)
            if (!user || user.email !== tokenData.email) {
                await reply.code(401).send()
                return
            }

            fastify.log.info(`Found authed user ${JSON.stringify(user)}`)
            authSession({ session: request.session, userId: user.id })

            return { status: 'ok', payload: { user } }
        }
    )
}
