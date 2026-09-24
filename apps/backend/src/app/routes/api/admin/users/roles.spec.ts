import fastifyAuth from '@fastify/auth'
import { Role, type User, UserStatus } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import rolesRoute from './roles.js'

const admin: User = {
    id: 'admin-1',
    status: UserStatus.Active,
    roles: [Role.User, Role.Admin],
    externalIds: []
}

async function createServer() {
    const server = Fastify()
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = admin
    })
    Reflect.set(server, 'verifyRoleAdmin', async () => undefined)
    const assignRoles = vi.fn(async (userId: string, roles: Role[]) => ({
        id: userId,
        status: UserStatus.Active,
        roles: [Role.User, ...roles],
        externalIds: []
    }))
    Reflect.set(server, 'userService', { assignRoles })
    await server.register(rolesRoute)
    return { server, assignRoles }
}

describe('POST /:userId/roles', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('assigns the requested roles and returns the updated user', async () => {
        const { server, assignRoles } = await createServer()
        servers.add(server)

        const response = await server.inject({
            method: 'POST',
            url: '/user-2/roles',
            payload: { roles: [Role.BetaTester, Role.Developer] }
        })

        expect(response.statusCode).toBe(200)
        expect(assignRoles).toHaveBeenCalledWith('user-2', [Role.BetaTester, Role.Developer])
        expect(response.json().payload.user.roles).toEqual([
            Role.User,
            Role.BetaTester,
            Role.Developer
        ])
    })

    it('rejects roles an administrator may not assign', async () => {
        const { server, assignRoles } = await createServer()
        servers.add(server)

        const response = await server.inject({
            method: 'POST',
            url: '/user-2/roles',
            payload: { roles: [Role.Admin] }
        })

        expect(response.statusCode).toBe(400)
        expect(assignRoles).not.toHaveBeenCalled()
    })
})
