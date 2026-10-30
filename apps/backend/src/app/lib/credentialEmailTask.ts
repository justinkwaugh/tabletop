import type { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { assertExists, BaseError, ErrorCategory } from '@tabletop/common'
import { concealedCause } from '@tabletop/backend-services'

export type CredentialEmailRequest = Static<typeof CredentialEmailRequest>
export const CredentialEmailRequest = Type.Object(
    {
        userId: Type.String(),
        token: Type.String(),
        email: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)

export class EmailDeliveryError extends BaseError {
    constructor(kind: string, cause?: Error) {
        super({
            category: ErrorCategory.System,
            name: 'EmailDeliveryError',
            message: `The ${kind} email could not be delivered`,
            metadata: { kind },
            cause
        })
    }
}

// The delivered token is a live credential: it reaches the email service and nothing else, so
// the task's log lines and any delivery failure name only the Account and the kind of email.
export function credentialEmailTask(
    fastify: FastifyInstance,
    {
        path,
        kind,
        deliver,
        explicitDestination = false
    }: {
        path: string
        kind: string
        deliver: (toEmail: string, token: string) => Promise<void>
        explicitDestination?: boolean
    }
): void {
    fastify.post<{ Body: CredentialEmailRequest }>(
        path,
        {
            schema: {
                body: explicitDestination
                    ? Type.Required(CredentialEmailRequest)
                    : Type.Omit(CredentialEmailRequest, ['email'])
            }
        },
        async function (request, reply) {
            const { userId, token, email } = request.body
            request.log.info({ userId, kind }, 'Sending credential email')
            const user = await fastify.userService.getUser(userId)
            if (!user || !user.email) {
                request.log.error(
                    { userId, kind },
                    'User not found or missing email address, cannot send credential email'
                )
                return
            }
            const toEmail = explicitDestination ? email : user.email
            assertExists(toEmail, 'The credential email schema requires its destination')
            try {
                await deliver(toEmail, token)
            } catch (error) {
                throw new EmailDeliveryError(kind, concealedCause(error, [token]))
            }
            await reply.code(200).send()
        }
    )
}
