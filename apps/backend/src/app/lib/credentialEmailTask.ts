import type { FastifyInstance, FastifyRequest } from 'fastify'
import { Type, type Static } from 'typebox'
import { BaseError, ErrorCategory } from '@tabletop/common'
import { concealedCause } from '@tabletop/backend-services'

export type CredentialEmailRequest = Static<typeof CredentialEmailRequest>
export const CredentialEmailRequest = Type.Object(
    {
        userId: Type.String(),
        token: Type.String()
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
type CredentialEmailDelivery = {
    kind: string
    deliver: (accountEmail: string, token: string) => Promise<void>
}

export function credentialEmailTask(
    fastify: FastifyInstance,
    { path, ...delivery }: CredentialEmailDelivery & { path: string }
): void {
    fastify.post<{ Body: CredentialEmailRequest }>(
        path,
        {
            schema: { body: CredentialEmailRequest }
        },
        async function (request, reply) {
            await deliverCredentialEmail(fastify, request, delivery)
            await reply.code(200).send()
        }
    )
}

export async function deliverCredentialEmail(
    fastify: FastifyInstance,
    request: FastifyRequest<{ Body: CredentialEmailRequest }>,
    { kind, deliver }: CredentialEmailDelivery
): Promise<void> {
    const { userId, token } = request.body
    request.log.info({ userId, kind }, 'Sending credential email')
    const user = await fastify.userService.getUser(userId)
    if (!user || !user.email) {
        request.log.error(
            { userId, kind },
            'User not found or missing email address, cannot send credential email'
        )
        return
    }
    try {
        await deliver(user.email, token)
    } catch (error) {
        throw new EmailDeliveryError(kind, concealedCause(error, [token]))
    }
}
