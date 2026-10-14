import { FastifyInstance } from 'fastify'
import { TurnReminderTask } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: TurnReminderTask }>(
        '/sendTurnNotification',
        {
            schema: { body: TurnReminderTask }
        },
        async function (request, reply) {
            await fastify.gameService.notifyIsYourTurn(request.body)
            await reply.code(200).send()
        }
    )
}
