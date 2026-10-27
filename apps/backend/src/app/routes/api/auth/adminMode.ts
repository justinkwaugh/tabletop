import { FastifyInstance, FastifyRequest } from 'fastify'
import { AuthenticatedSession, SessionNotLiveError } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    const administrator = fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
        relation: 'and'
    })

    function liveSession(request: FastifyRequest): AuthenticatedSession {
        const session = request.authenticatedSession
        if (!session) {
            throw new SessionNotLiveError()
        }
        return session
    }

    function adminModeResponse(session: AuthenticatedSession) {
        const active = fastify.sessionService.isInAdminMode(session)
        return {
            status: 'ok',
            payload: {
                adminMode: active ? { expiresAt: session.adminModeExpiresAt } : undefined
            }
        }
    }

    fastify.get('/admin-mode', { onRequest: administrator }, async function (request) {
        return adminModeResponse(liveSession(request))
    })

    fastify.post(
        '/admin-mode/activate',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            onRequest: fastify.auth(
                [
                    fastify.verifyActiveUser,
                    fastify.verifyRoleAdmin,
                    fastify.verifyRecentAuthentication
                ],
                { relation: 'and' }
            )
        },
        async function (request) {
            const user = request.user
            if (!user) {
                throw new SessionNotLiveError()
            }
            const activated = await fastify.sessionService.activateAdminMode(
                liveSession(request),
                user
            )
            return adminModeResponse(activated)
        }
    )

    fastify.post('/admin-mode/deactivate', { onRequest: administrator }, async function (request) {
        await fastify.sessionService.deactivateAdminMode(liveSession(request))
        return { status: 'ok', payload: { adminMode: undefined } }
    })
}
