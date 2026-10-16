import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserStatus } from '@tabletop/common'
import type { LeagueEmailContent } from '@tabletop/backend-services'
import leagueEmailRoute from './email.js'

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

const base = {
    leagueId: 'fresh-league',
    leagueName: 'Fresh Fish League',
    titleId: 'fresh-fish',
    seasonNumber: 2
}

async function setup(content: LeagueEmailContent | undefined) {
    const server = Fastify()
    servers.push(server)
    const recipient = {
        id: 'user-1',
        username: 'Alice',
        email: 'alice@example.test',
        status: UserStatus.Active
    }
    const getUser = vi.fn(async (id: string) => (id === recipient.id ? recipient : undefined))
    const emailContent = vi.fn(async () => content)
    const getTitle = vi.fn((id: string) =>
        id === 'fresh-fish' ? { info: { metadata: { name: 'Fresh Fish' } } } : undefined
    )
    const sendLeagueSignUpEmail = vi.fn(async () => undefined)
    const sendLeagueSeasonStartEmail = vi.fn(async () => undefined)
    const sendLeagueSeasonResultsEmail = vi.fn(async () => undefined)
    const claimed = new Set<string>()
    const claimOnce = vi.fn(async (key: string) => !claimed.has(key) && !!claimed.add(key))
    const release = vi.fn(async (key: string) => {
        claimed.delete(key)
    })
    await server.register(sensible)
    Reflect.set(server, 'cacheService', { claimOnce, delete: release })
    Reflect.set(server, 'userService', { getUser })
    Reflect.set(server, 'leagueService', { emailContent })
    Reflect.set(server, 'gameService', { getTitle })
    Reflect.set(server, 'emailService', {
        sendLeagueSignUpEmail,
        sendLeagueSeasonStartEmail,
        sendLeagueSeasonResultsEmail
    })
    await server.register(leagueEmailRoute)
    return {
        server,
        sendLeagueSignUpEmail,
        sendLeagueSeasonStartEmail,
        sendLeagueSeasonResultsEmail,
        release
    }
}

const payload = (kind: string, userId = 'user-1') => ({
    leagueId: 'fresh-league',
    season: 2,
    userId,
    kind
})

describe('league email task', () => {
    it('sends a sign-up reminder linking to the league', async () => {
        const { server, sendLeagueSignUpEmail } = await setup({
            ...base,
            kind: 'signUpReminder',
            level: 'B',
            closesAt: 1_000
        })
        expect(
            (await server.inject({ method: 'POST', url: '/email', payload: {} })).statusCode
        ).toBe(400)
        const response = await server.inject({
            method: 'POST',
            url: '/email',
            payload: payload('signUpReminder')
        })
        expect(response.statusCode).toBe(200)
        expect(sendLeagueSignUpEmail).toHaveBeenCalledWith({
            reminder: true,
            leagueName: 'Fresh Fish League',
            title: 'Fresh Fish',
            seasonNumber: 2,
            level: 'B',
            closesAt: 1_000,
            url: 'https://example.test/leagues/fresh-league',
            toEmail: 'alice@example.test'
        })
    })

    it('sends a season start email linking to the group', async () => {
        const { server, sendLeagueSeasonStartEmail } = await setup({
            ...base,
            kind: 'seasonStart',
            groupName: 'B1',
            level: { name: 'B', moved: 'up' },
            opponents: ['Bob'],
            gamesEach: 4,
            tournamentId: 'group-b1'
        })
        await server.inject({ method: 'POST', url: '/email', payload: payload('seasonStart') })
        expect(sendLeagueSeasonStartEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                groupName: 'B1',
                level: { name: 'B', moved: 'up' },
                url: 'https://example.test/tournaments/group-b1',
                toEmail: 'alice@example.test'
            })
        )
    })

    it('sends season results linking to the finished season', async () => {
        const standings = [
            { rank: 1, name: 'Alice', wins: 3, score: 3, recipient: true },
            { rank: 2, name: 'Bob', wins: 1, score: 1, recipient: false }
        ]
        const { server, sendLeagueSeasonResultsEmail } = await setup({
            ...base,
            kind: 'seasonResults',
            groupName: 'B1',
            place: 1,
            movement: 'promoted',
            nextLevel: 'A',
            champion: 'Carol',
            standings
        })
        await server.inject({ method: 'POST', url: '/email', payload: payload('seasonResults') })
        expect(sendLeagueSeasonResultsEmail).toHaveBeenCalledWith({
            leagueName: 'Fresh Fish League',
            title: 'Fresh Fish',
            seasonNumber: 2,
            groupName: 'B1',
            place: 1,
            movement: 'promoted',
            nextLevel: 'A',
            champion: 'Carol',
            standings,
            url: 'https://example.test/leagues/fresh-league?season=2',
            toEmail: 'alice@example.test'
        })
    })

    it('sends each email once and releases the claim when sending fails', async () => {
        const { server, sendLeagueSignUpEmail, release } = await setup({
            ...base,
            kind: 'signUpOpen',
            level: 'A',
            closesAt: 1
        })
        sendLeagueSignUpEmail.mockRejectedValueOnce(new Error('Resend unavailable'))
        const send = () =>
            server.inject({ method: 'POST', url: '/email', payload: payload('signUpOpen') })
        expect((await send()).statusCode).toBe(500)
        expect(release).toHaveBeenCalledTimes(1)
        expect((await send()).json()).toEqual({ status: 'ok' })
        expect((await send()).json()).toEqual({ status: 'duplicate' })
        expect(sendLeagueSignUpEmail).toHaveBeenCalledTimes(2)
    })

    it('sends a new reminder when the sign-up close moves', async () => {
        const { server, sendLeagueSignUpEmail } = await setup({
            ...base,
            kind: 'signUpReminder',
            level: 'B',
            closesAt: 1_000
        })
        const remind = (closesAt: number) =>
            server.inject({
                method: 'POST',
                url: '/email',
                payload: { ...payload('signUpReminder'), closesAt }
            })
        expect((await remind(1_000)).json()).toEqual({ status: 'ok' })
        expect((await remind(1_000)).json()).toEqual({ status: 'duplicate' })
        expect((await remind(2_000)).json()).toEqual({ status: 'ok' })
        expect(sendLeagueSignUpEmail).toHaveBeenCalledTimes(2)
    })

    it('skips unknown recipients and emails that no longer apply', async () => {
        const missing = await setup({ ...base, kind: 'signUpOpen', level: 'A', closesAt: 1 })
        await missing.server.inject({
            method: 'POST',
            url: '/email',
            payload: payload('signUpOpen', 'missing')
        })
        expect(missing.sendLeagueSignUpEmail).not.toHaveBeenCalled()

        const stale = await setup(undefined)
        const response = await stale.server.inject({
            method: 'POST',
            url: '/email',
            payload: payload('signUpReminder')
        })
        expect(response.json()).toEqual({ status: 'skipped' })
        expect(stale.sendLeagueSignUpEmail).not.toHaveBeenCalled()
    })
})
