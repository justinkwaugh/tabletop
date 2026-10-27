import { measure } from '@tabletop/backend-services/diagnostics'
import fp from 'fastify-plugin'
import { User, Role, UserStatus } from '@tabletop/common'
import {
    AuthenticatedSession,
    RecentAuthenticationRequiredError,
    requireSessionEligibleAccount
} from '@tabletop/backend-services'
import { FastifyAuthFunction } from '@fastify/auth'
import { FastifyInstance, FastifyRequest } from 'fastify'

declare module 'fastify' {
    interface FastifyInstance {
        verifyUser: FastifyAuthFunction
        verifyIncompleteUser: FastifyAuthFunction
        verifyActiveUser: FastifyAuthFunction
        verifyRoleUser: FastifyAuthFunction
        verifyRoleAdmin: FastifyAuthFunction
        verifyRecentAuthentication: FastifyAuthFunction
    }

    interface FastifyRequest {
        user?: User
        authenticatedSession?: AuthenticatedSession
    }
}

export default fp(async function (fastify: FastifyInstance) {
    async function verifyActiveUser(request: FastifyRequest) {
        const user = await getUserForSession(request)
        if (user.status !== UserStatus.Active) {
            throw new Error('User is not active')
        }

        request.user = user
    }

    async function verifyUser(request: FastifyRequest) {
        const user = await getUserForSession(request)
        request.user = user
    }

    async function verifyIncompleteUser(request: FastifyRequest) {
        const user = await getUserForSession(request)
        if (user.status !== UserStatus.Incomplete) {
            throw new Error('User is not active')
        }

        request.user = user
    }

    async function getUserForSession(request: FastifyRequest): Promise<User> {
        const sessionId = request.session.get('sessionId')
        if (!sessionId) {
            throw new Error('No session id in cookie')
        }

        const authorized = await measure('auth.session', () =>
            fastify.sessionService.authorize(sessionId, (userId) =>
                measure('auth.user', () => fastify.userService.getUserForAuthorization(userId))
            )
        )
        if (!authorized) {
            throw new Error('Session is not live')
        }
        requireSessionEligibleAccount(authorized.user)
        request.authenticatedSession = authorized.session
        return authorized.user
    }

    async function verifyRecentAuthentication(request: FastifyRequest) {
        const session = request.authenticatedSession
        if (!session) {
            throw fastify.httpErrors.unauthorized('No session found')
        }
        if (!fastify.sessionService.isRecentlyAuthenticated(session)) {
            throw new RecentAuthenticationRequiredError()
        }
    }

    async function verifyRoleUser(request: FastifyRequest) {
        verifyRole(request, Role.User)
    }

    async function verifyRoleAdmin(request: FastifyRequest) {
        verifyRole(request, Role.Admin)
    }

    function verifyRole(request: FastifyRequest, role: Role) {
        const user = request.user
        if (!user) {
            throw fastify.httpErrors.unauthorized('No user found')
        }

        if (!user.roles.includes(role)) {
            throw fastify.httpErrors.forbidden('User does not have ' + role + ' role')
        }
    }

    fastify.decorate('verifyUser', verifyUser)
    fastify.decorate('verifyActiveUser', verifyActiveUser)
    fastify.decorate('verifyIncompleteUser', verifyIncompleteUser)
    fastify.decorate('verifyRoleUser', verifyRoleUser)
    fastify.decorate('verifyRoleAdmin', verifyRoleAdmin)
    fastify.decorate('verifyRecentAuthentication', verifyRecentAuthentication)
})
