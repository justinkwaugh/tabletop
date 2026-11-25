import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { LocaleTag } from '@tabletop/common'
import { AccountChangeType, emailRecipient, type EmailRecipient } from '@tabletop/backend-services'
import { supportedLocale } from '@tabletop/email/i18n'

type SendAccountChangedNotificationEmailRequest = Static<
    typeof SendAccountChangedNotificationEmailRequest
>
const SendAccountChangedNotificationEmailRequest = Type.Object(
    {
        email: Type.String(),
        changeType: Type.Enum(AccountChangeType),
        timestamp: Type.String(),
        username: Type.Optional(Type.String()),
        locale: Type.Optional(LocaleTag),
        timeZone: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    // Tasks queued before the language travelled with them find it on the account the address
    // still belongs to.
    async function recipient({
        email,
        locale,
        timeZone
    }: SendAccountChangedNotificationEmailRequest): Promise<EmailRecipient> {
        if (!locale) return emailRecipient(email, await fastify.userService.getUserByEmail(email))
        return { email, locale: supportedLocale(locale), ...(timeZone ? { timeZone } : {}) }
    }

    fastify.post<{ Body: SendAccountChangedNotificationEmailRequest }>(
        '/sendAccountChangedNotificationEmail',
        {
            schema: { body: SendAccountChangedNotificationEmailRequest }
        },
        async function (request, reply) {
            const { changeType, timestamp, username } = request.body
            await fastify.emailService.sendAccountChangedNotificationEmail(
                changeType,
                new Date(timestamp),
                await recipient(request.body),
                username
            )
            await reply.code(200).send()
        }
    )
}
