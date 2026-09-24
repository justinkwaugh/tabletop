import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { afterEach, describe, expect, it, vi } from 'vitest'
import resultsEmailRoute from './resultsEmail.js'

vi.hoisted(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop')
    vi.stubEnv('FRONTEND_HOST', 'https://example.test')
})

const servers: ReturnType<typeof Fastify>[] = []
afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await Promise.all(servers.splice(0).map((server) => server.close()))
})

async function setup() {
    const server = Fastify()
    servers.push(server)
    const recipient = { id: 'user-1', username: 'Alice' }
    const definition = { info: { id: 'fresh-fish', metadata: { name: 'Fresh Fish' } } }
    const detail = {
        tournament: {
            id: 'event',
            name: 'Autumn Mini',
            status: 'finished',
            rules: { titleId: 'fresh-fish' }
        },
        usernames: { 'user-1': 'Alice' },
        standings: []
    }
    const getUser = vi.fn(async (id: string) => (id === recipient.id ? recipient : undefined))
    const get = vi.fn(async () => detail)
    const getTitle = vi.fn((id: string) => (id === 'fresh-fish' ? definition : undefined))
    const sendTournamentResultsEmail = vi.fn(async () => undefined)
    await server.register(sensible)
    Reflect.set(server, 'userService', { getUser })
    Reflect.set(server, 'tournamentService', { get })
    Reflect.set(server, 'gameService', { getTitle })
    Reflect.set(server, 'emailService', { sendTournamentResultsEmail })
    await server.register(resultsEmailRoute)
    return { server, recipient, definition, detail, get, sendTournamentResultsEmail }
}

describe('tournament results email task', () => {
    it('validates the payload and renders results for the recipient', async () => {
        const { server, recipient, definition, detail, get, sendTournamentResultsEmail } =
            await setup()
        expect(
            (await server.inject({ method: 'POST', url: '/resultsEmail', payload: {} })).statusCode
        ).toBe(400)
        const payload = { tournamentId: 'event', userId: 'user-1', toEmail: 'alice@example.test' }
        const response = await server.inject({ method: 'POST', url: '/resultsEmail', payload })
        expect(response.statusCode).toBe(200)
        expect(get).toHaveBeenCalledWith('event', recipient)
        expect(sendTournamentResultsEmail).toHaveBeenCalledWith({
            detail,
            definition,
            recipientId: 'user-1',
            url: 'https://example.test/tournaments/event',
            toEmail: 'alice@example.test'
        })
    })

    it('skips unknown recipients without sending', async () => {
        const { server, sendTournamentResultsEmail } = await setup()
        const payload = { tournamentId: 'event', userId: 'missing', toEmail: 'x@example.test' }
        const response = await server.inject({ method: 'POST', url: '/resultsEmail', payload })
        expect(response.statusCode).toBe(200)
        expect(sendTournamentResultsEmail).not.toHaveBeenCalled()
    })

    it('returns failure so the queue can retry the original task', async () => {
        const { server, get, sendTournamentResultsEmail } = await setup()
        get.mockRejectedValueOnce(new Error('Tournament read failed'))
        const payload = { tournamentId: 'event', userId: 'user-1', toEmail: 'alice@example.test' }
        expect(
            (await server.inject({ method: 'POST', url: '/resultsEmail', payload })).statusCode
        ).toBe(500)
        expect(
            (await server.inject({ method: 'POST', url: '/resultsEmail', payload })).statusCode
        ).toBe(200)
        expect(sendTournamentResultsEmail).toHaveBeenCalledTimes(1)
    })
})
