import fp from 'fastify-plugin'
import { User, Role, UserStatus } from '@tabletop/common'
import { FastifyAuthFunction } from '@fastify/auth'
import { FastifyInstance, FastifyRequest } from 'fastify'

declare module 'fastify' {
    interface FastifyInstance {
        verifyUser: FastifyAuthFunction
        verifyIncompleteUser: FastifyAuthFunction
        verifyActiveUser: FastifyAuthFunction
        verifyRoleUser: FastifyAuthFunction
        verifyRoleAdmin: FastifyAuthFunction
    }

    interface FastifyRequest {
        user?: User
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
        const userId = request.session.get('userId')
        if (!userId) {
            throw new Error('No user id in session')
        }
        fastify.log.info(`userId was ${userId}`)

        const user = await fastify.userService.getUser(userId)
        if (!user) {
            throw new Error('No user found for id ' + userId)
        }
        return user
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
            throw new Error('No user found')
        }

        if (!user.roles.includes(role)) {
            throw new Error('User does not have ' + role + ' role')
        }
    }

    fastify.decorate('verifyUser', verifyUser)
    fastify.decorate('verifyActiveUser', verifyActiveUser)
    fastify.decorate('verifyIncompleteUser', verifyIncompleteUser)
    fastify.decorate('verifyRoleUser', verifyRoleUser)
    fastify.decorate('verifyRoleAdmin', verifyRoleAdmin)
})
