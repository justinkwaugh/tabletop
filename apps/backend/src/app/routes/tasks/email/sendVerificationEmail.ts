import { FastifyInstance } from 'fastify'
import { emailRecipient } from '@tabletop/backend-services'
import { credentialEmailTask } from '../../../lib/credentialEmailTask.js'

export default async function (fastify: FastifyInstance) {
    credentialEmailTask(fastify, {
        path: '/sendVerificationEmail',
        kind: 'email-verification',
        deliver: (account, token) =>
            fastify.emailService.sendVerificationEmail(
                token,
                emailRecipient(account.email, account)
            )
    })
}
