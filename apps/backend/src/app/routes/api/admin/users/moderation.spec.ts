import fastifyAuth from '@fastify/auth'
import { Role, type User, UserStatus } from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import moderationRoute from './moderation.js'

const admin: User = {
    id: 'admin-1',
    status: UserStatus.Active,
    roles: [Role.User, Role.Admin],
    externalIds: []
}

const target: User = {
    id: 'user-2',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

async function createServer(isAdmin = true) {
    const server = Fastify()
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = admin
    })
    Reflect.set(server, 'verifyRoleAdmin', async () => {
        if (!isAdmin) throw new Error('User does not have admin role')
    })
    const accountModeration = {
        rename: vi.fn(async (_userId: string, username: string) => ({ ...target, username })),
        ban: vi.fn(async () => ({ ...target, status: UserStatus.Inactive })),
        unban: vi.fn(async () => target)
    }
    Reflect.set(server, 'accountModeration', accountModeration)
    await server.register(moderationRoute)
    return { server, accountModeration }
}

describe('admin account moderation routes', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()
    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('renames the account', async () => {
        const { server, accountModeration } = await createServer()
        servers.add(server)
        const response = await server.inject({
            method: 'POST',
            url: '/user-2/username',
            payload: { username: 'Robert' }
        })
        expect(response.statusCode).toBe(200)
        expect(accountModeration.rename).toHaveBeenCalledExactlyOnceWith('user-2', 'Robert')
        expect(response.json().payload.user.username).toBe('Robert')
    })

    it('bans on behalf of the acting administrator', async () => {
        const { server, accountModeration } = await createServer()
        servers.add(server)
        const response = await server.inject({ method: 'POST', url: '/user-2/ban' })
        expect(response.statusCode).toBe(200)
        expect(accountModeration.ban).toHaveBeenCalledExactlyOnceWith('user-2', 'admin-1')
        expect(response.json().payload.user.status).toBe(UserStatus.Inactive)
    })

    it('lifts a ban', async () => {
        const { server, accountModeration } = await createServer()
        servers.add(server)
        const response = await server.inject({ method: 'POST', url: '/user-2/unban' })
        expect(response.statusCode).toBe(200)
        expect(accountModeration.unban).toHaveBeenCalledExactlyOnceWith('user-2')
    })

    it.each([
        ['/user-2/username', { username: 'Robert' }],
        ['/user-2/ban', undefined],
        ['/user-2/unban', undefined]
    ])('refuses %s to a non-administrator', async (url, payload) => {
        const { server, accountModeration } = await createServer(false)
        servers.add(server)
        const response = await server.inject({ method: 'POST', url, payload })
        expect(response.statusCode).toBeGreaterThanOrEqual(400)
        expect(accountModeration.rename).not.toHaveBeenCalled()
        expect(accountModeration.ban).not.toHaveBeenCalled()
        expect(accountModeration.unban).not.toHaveBeenCalled()
    })
})
