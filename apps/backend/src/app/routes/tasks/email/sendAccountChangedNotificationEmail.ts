import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { AccountChangeType } from '@tabletop/backend-services'

type SendAccountChangedNotificationEmailRequest = Static<
    typeof SendAccountChangedNotificationEmailRequest
>
const SendAccountChangedNotificationEmailRequest = Type.Object(
    {
        email: Type.String(),
        changeType: Type.Enum(AccountChangeType),
        timestamp: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SendAccountChangedNotificationEmailRequest }>(
        '/sendAccountChangedNotificationEmail',
        {
            schema: { body: SendAccountChangedNotificationEmailRequest }
        },
        async function (request, reply) {
            const { email, changeType, timestamp } = request.body
            const dateTimestamp = new Date(timestamp)

            await fastify.emailService.sendAccountChangedNotificationEmail(
                changeType,
                dateTimestamp,
                email
            )
            await reply.code(200).send()
        }
    )
}
