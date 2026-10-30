import type { FastifyInstance } from 'fastify'
import { credentialEmailTask } from '../../../lib/credentialEmailTask.js'

export default async function (fastify: FastifyInstance) {
    credentialEmailTask(fastify, {
        path: '/sendEmailChangeVerification',
        kind: 'email-change',
        explicitDestination: true,
        deliver: (toEmail, token) => fastify.emailService.sendVerificationEmail(token, toEmail)
    })
}
