import type { FastifyInstance } from 'fastify'
import { OAuth2Client } from 'google-auth-library'

export default async function (fastify: FastifyInstance) {
    const verifier = new OAuth2Client()
    fastify.post(
        '/reconcile',
        {
            onRequest: async (request) => {
                const email = process.env['TOURNAMENT_SCHEDULER_EMAIL']
                const audience = process.env['TOURNAMENT_SCHEDULER_AUDIENCE']
                if (!email || !audience)
                    throw fastify.httpErrors.serviceUnavailable(
                        'Tournament scheduler identity is not configured'
                    )
                const authorization = request.headers.authorization
                if (!authorization?.startsWith('Bearer ')) throw fastify.httpErrors.unauthorized()
                try {
                    const ticket = await verifier.verifyIdToken({
                        idToken: authorization.slice(7),
                        audience
                    })
                    const identity = ticket.getPayload()
                    if (identity?.email !== email || !identity.email_verified)
                        throw new Error('Unexpected scheduler identity')
                } catch {
                    throw fastify.httpErrors.unauthorized()
                }
            }
        },
        async () => ({
            status: 'ok',
            payload: { processed: await fastify.tournamentService.reconcileDue() }
        })
    )
}
