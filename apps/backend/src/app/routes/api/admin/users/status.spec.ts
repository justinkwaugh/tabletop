import fastifyAuth from '@fastify/auth'
import { Role, type AccountStatusTransition, type User, UserStatus } from '@tabletop/common'
import Fastify, { type FastifyRequest } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import { RealtimeControl, type RealtimeRevocation } from '@tabletop/backend-services'
import statusRoute from './status.js'

const admin: User = {
    id: 'admin-1',
    status: UserStatus.Active,
    roles: [Role.User, Role.Admin],
    externalIds: []
}

async function createServer({ adminMode = true }: { adminMode?: boolean } = {}) {
    const server = Fastify()
    await server.register(fastifyAuth)
    server.decorate('verifyActiveUser', async (request: FastifyRequest) => {
        request.user = admin
    })
    server.decorate('verifyAdminMode', async () => {
        if (!adminMode) throw new Error('Admin Mode required')
    })
    const transitionAccountStatus = vi.fn(
        async (userId: string, transition: AccountStatusTransition): Promise<User> => ({
            id: userId,
            status: transition === 'deactivate' ? UserStatus.Inactive : UserStatus.Active,
            roles: [Role.User],
            externalIds: [],
            sessionGeneration: transition === 'deactivate' ? 1 : 0
        })
    )
    server.decorate('userService', { transitionAccountStatus })
    const revocations: RealtimeRevocation[] = []
    server.decorate(
        'realtimeControl',
        new RealtimeControl({
            publishMessage: async ({ message }) => {
                revocations.push(JSON.parse(message))
            }
        })
    )
    await server.register(statusRoute)
    return { server, transitionAccountStatus, revocations }
}

describe('POST /:userId/status', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    async function fixture(options?: { adminMode?: boolean }) {
        const created = await createServer(options)
        servers.add(created.server)
        return created
    }

    function change(server: ReturnType<typeof Fastify>, payload: unknown) {
        return server.inject({ method: 'POST', url: '/user-2/status', payload })
    }

    it('deactivates the Account, returns it and ends its realtime connections', async () => {
        const { server, transitionAccountStatus, revocations } = await fixture()
        const response = await change(server, { transition: 'deactivate' })
        expect(response.statusCode).toBe(200)
        expect(transitionAccountStatus).toHaveBeenCalledExactlyOnceWith('user-2', 'deactivate')
        expect(response.json().payload.user).toMatchObject({
            id: 'user-2',
            status: UserStatus.Inactive,
            sessionGeneration: 1
        })
        expect(revocations).toEqual([expect.objectContaining({ revoke: 'user-2' })])
    })

    it('reactivates the Account without a realtime revocation', async () => {
        const { server, transitionAccountStatus, revocations } = await fixture()
        const response = await change(server, { transition: 'reactivate' })
        expect(response.statusCode).toBe(200)
        expect(transitionAccountStatus).toHaveBeenCalledExactlyOnceWith('user-2', 'reactivate')
        expect(response.json().payload.user.status).toBe(UserStatus.Active)
        expect(revocations).toEqual([])
    })

    it('rejects a transition the schema does not name', async () => {
        const { server, transitionAccountStatus } = await fixture()
        for (const payload of [{ transition: 'delete' }, { status: UserStatus.Inactive }, {}]) {
            expect((await change(server, payload)).statusCode).toBe(400)
        }
        expect(transitionAccountStatus).not.toHaveBeenCalled()
    })

    it('passes only the transition to the service, never other submitted fields', async () => {
        const { server, transitionAccountStatus } = await fixture()
        const response = await change(server, {
            transition: 'deactivate',
            status: UserStatus.Active,
            sessionGeneration: 9
        })
        expect(response.statusCode).toBe(200)
        expect(transitionAccountStatus).toHaveBeenCalledExactlyOnceWith('user-2', 'deactivate')
    })

    it('refuses an Administrator outside Admin Mode before reaching the service', async () => {
        const { server, transitionAccountStatus, revocations } = await fixture({
            adminMode: false
        })
        expect((await change(server, { transition: 'deactivate' })).statusCode).toBe(401)
        expect(transitionAccountStatus).not.toHaveBeenCalled()
        expect(revocations).toEqual([])
    })
})
