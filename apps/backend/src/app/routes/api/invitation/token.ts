import { FastifyInstance } from 'fastify'
import { GameInvitationTokenData, TokenType } from '@tabletop/backend-services'
import { Type, type Static } from '@sinclair/typebox'

type ParamsType = Static<typeof ParamsType>
const ParamsType = Type.Object({
    token: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: ParamsType }>(
        '/token/:token',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            if (!request.user) {
                throw Error('No user found for token request')
            }

            const { token } = request.params

            const tokenData = await fastify.tokenService.getData<GameInvitationTokenData>({
                token,
                expectedType: TokenType.GameInvitation
            })
            if (!tokenData) {
                await reply.code(404).send()
                return
            }

            if (tokenData.userId !== request.user.id) {
                await reply.code(401).send()
                return
            }

            const game = await fastify.gameService.checkInvitation({
                user: request.user,
                gameId: tokenData.gameId
            })
            return { status: 'ok', payload: { game } }
        }
    )
}
