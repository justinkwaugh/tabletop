import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type SendTurnNotificationRequest = Static<typeof SendTurnNotificationRequest>
const SendTurnNotificationRequest = Type.Object(
    {
        userId: Type.String(),
        gameId: Type.String(),
        notificationId: Type.String(),
        delay: Type.Optional(Type.Number())
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SendTurnNotificationRequest }>(
        '/sendTurnNotification',
        {
            schema: { body: SendTurnNotificationRequest }
        },
        async function (request, reply) {
            const { userId, gameId, notificationId, delay } = request.body
            await fastify.gameService.notifyIsYourTurn(userId, gameId, notificationId, delay)
            await reply.code(200).send()
        }
    )
}
