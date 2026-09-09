import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { LoginTicket, OAuth2Client } from 'google-auth-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import reconcileRoute from './reconcile.js'

const servers: ReturnType<typeof Fastify>[] = []
afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await Promise.all(servers.splice(0).map((server) => server.close()))
})

async function setup() {
    const server = Fastify()
    servers.push(server)
    const reconcileDue = vi.fn(async () => 2)
    await server.register(sensible)
    Reflect.set(server, 'tournamentService', { reconcileDue })
    await server.register(reconcileRoute)
    vi.stubEnv('TOURNAMENT_SCHEDULER_EMAIL', 'scheduler@example.test')
    vi.stubEnv('TOURNAMENT_SCHEDULER_AUDIENCE', 'task-audience')
    return { server, reconcileDue }
}

describe('scheduled tournament closure', () => {
    it('requires a configured identity and a bearer token', async () => {
        const { server, reconcileDue } = await setup()
        expect((await server.inject({ method: 'POST', url: '/reconcile' })).statusCode).toBe(401)
        vi.stubEnv('TOURNAMENT_SCHEDULER_EMAIL', '')
        expect((await server.inject({ method: 'POST', url: '/reconcile' })).statusCode).toBe(503)
        expect(reconcileDue).not.toHaveBeenCalled()
    })
    it('only reconciles for the verified scheduler identity and configured audience', async () => {
        const { server, reconcileDue } = await setup()
        let email = 'wrong@example.test'
        const verify = vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(
            async () =>
                new LoginTicket('header', {
                    iss: 'https://accounts.google.com',
                    sub: 'scheduler',
                    aud: 'task-audience',
                    iat: 1,
                    exp: 2,
                    email,
                    email_verified: true
                })
        )
        const request = {
            method: 'POST',
            url: '/reconcile',
            headers: { authorization: 'Bearer test-token' }
        } as const
        expect((await server.inject(request)).statusCode).toBe(401)
        expect(reconcileDue).not.toHaveBeenCalled()
        email = 'scheduler@example.test'
        const response = await server.inject(request)
        expect(response.statusCode).toBe(200)
        expect(response.json().payload.processed).toBe(2)
        expect(verify).toHaveBeenCalledWith({ idToken: 'test-token', audience: 'task-audience' })
        expect(reconcileDue).toHaveBeenCalledOnce()
    })
})
