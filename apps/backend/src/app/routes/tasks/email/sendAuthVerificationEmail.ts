import { FastifyInstance } from 'fastify'
import { credentialEmailTask } from '../../../lib/credentialEmailTask.js'

export default async function (fastify: FastifyInstance) {
    credentialEmailTask(fastify, {
        path: '/sendAuthVerificationEmail',
        kind: 'sensitive-change',
        deliver: (toEmail, token) => fastify.emailService.sendVerificationEmail(token, toEmail)
    })
}
