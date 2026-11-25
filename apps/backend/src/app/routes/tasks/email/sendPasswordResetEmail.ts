import { FastifyInstance } from 'fastify'
import { emailRecipient } from '@tabletop/backend-services'
import { credentialEmailTask } from '../../../lib/credentialEmailTask.js'

const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''

export default async function (fastify: FastifyInstance) {
    credentialEmailTask(fastify, {
        path: '/sendPasswordResetEmail',
        kind: 'password-reset',
        deliver: (account, token) =>
            fastify.emailService.sendPasswordResetEmail(
                token,
                `${FRONTEND_HOST}/email/passwordReset/${token}`,
                emailRecipient(account.email, account)
            )
    })
}
