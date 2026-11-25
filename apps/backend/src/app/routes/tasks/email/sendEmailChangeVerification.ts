import type { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { emailRecipient } from '@tabletop/backend-services'
import { CredentialEmailRequest, deliverCredentialEmail } from '../../../lib/credentialEmailTask.js'

const EmailChangeVerificationRequest = Type.Object(
    { ...CredentialEmailRequest.properties, email: Type.String() },
    { additionalProperties: false }
)
type EmailChangeVerificationRequest = Static<typeof EmailChangeVerificationRequest>

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: EmailChangeVerificationRequest }>(
        '/sendEmailChangeVerification',
        { schema: { body: EmailChangeVerificationRequest } },
        async (request, reply) => {
            await deliverCredentialEmail(fastify, request, {
                kind: 'email-change',
                deliver: (account, token) =>
                    fastify.emailService.sendVerificationEmail(
                        token,
                        emailRecipient(request.body.email, account)
                    )
            })
            await reply.code(200).send()
        }
    )
}
