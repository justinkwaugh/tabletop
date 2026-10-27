import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    OAUTH_STATE_LIFETIME_SECONDS,
    RECENT_AUTHENTICATION_SECONDS
} from '@tabletop/backend-services'

vi.hoisted(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop')
    vi.stubEnv('FRONTEND_HOST', 'https://site.test')
})
import {
    closing,
    discordFixture,
    PASSWORD,
    type DiscordFixture
} from '../../../../tests/discordFixture.js'

const servers = new Set<FastifyInstance>()
afterEach(closing(servers))

async function fixture(): Promise<DiscordFixture> {
    const created = await discordFixture()
    servers.add(created.server)
    return created
}

function victimLinks(f: DiscordFixture) {
    return f.users.get('victim')?.externalIds ?? []
}

describe('Discord linking callbacks are bound to the initiating session', () => {
    it('rejects an unsolicited code that carries no state', async () => {
        const f = await fixture()
        const { cookie } = await f.signIn('victim')
        const response = await f.post('/auth/discord/link', { code: 'attacker-code' }, cookie)
        expect(response.statusCode).toBe(400)
        expect(f.exchangeCode).not.toHaveBeenCalled()
        expect(victimLinks(f)).toEqual([])
    })

    it('rejects a forged state that was never issued', async () => {
        const f = await fixture()
        const { cookie } = await f.signIn('victim')
        const response = await f.post(
            '/auth/discord/link',
            { code: 'attacker-code', state: 'link.0123456789abcdefghijklmnopqrstuv' },
            cookie
        )
        expect(response.statusCode).toBe(400)
        expect(f.exchangeCode).not.toHaveBeenCalled()
        expect(victimLinks(f)).toEqual([])
    })

    it('rejects a link state that another session began, and burns it', async () => {
        const f = await fixture()
        const attacker = await f.signIn('attacker')
        const victim = await f.signIn('victim')
        const { state } = await f.begin('link', attacker.cookie)
        expect(state).toMatch(/^link\./)
        const injected = await f.post(
            '/auth/discord/link',
            { code: 'attacker-code', state },
            victim.cookie
        )
        expect(injected.statusCode).toBe(400)
        expect(victimLinks(f)).toEqual([])
        expect(f.exchangeCode).not.toHaveBeenCalled()
        const retried = await f.post(
            '/auth/discord/link',
            { code: 'attacker-code', state },
            attacker.cookie
        )
        expect(retried.statusCode).toBe(400)
        expect(f.stateStore.size).toBe(0)
    })

    it('rejects a login state at the link route and a link state at the login route', async () => {
        const f = await fixture()
        const victim = await f.signIn('victim')
        const login = await f.begin('login', victim.cookie)
        const link = await f.begin('link', victim.cookie)
        const linkWithLoginState = await f.post(
            '/auth/discord/link',
            { code: 'victim-code', state: login.state },
            link.cookie
        )
        expect(linkWithLoginState.statusCode).toBe(400)
        const loginWithLinkState = await f.post(
            '/auth/discord/login',
            { code: 'victim-code', state: link.state },
            link.cookie
        )
        expect(loginWithLinkState.statusCode).toBe(400)
        expect(f.exchangeCode).not.toHaveBeenCalled()
        expect(victimLinks(f)).toEqual([])
        expect(f.sessionStore.size).toBe(1)
    })

    it('rejects a state after its lifetime', async () => {
        const f = await fixture()
        const victim = await f.signIn('victim')
        const { state } = await f.begin('link', victim.cookie)
        f.advance(OAUTH_STATE_LIFETIME_SECONDS)
        const response = await f.post(
            '/auth/discord/link',
            { code: 'victim-code', state },
            victim.cookie
        )
        expect(response.statusCode).toBe(400)
        expect(f.exchangeCode).not.toHaveBeenCalled()
        expect(victimLinks(f)).toEqual([])
    })

    it('completes a recently authenticated link once and rejects the replay', async () => {
        const f = await fixture()
        const victim = await f.signIn('victim')
        const { state, response: begun } = await f.begin('link', victim.cookie)
        expect(begun.json().payload.authorizationUrl).toBe(
            `https://discord.test/authorize?redirect_uri=${encodeURIComponent('https://site.test/oauth/discord/link')}&state=${state}`
        )
        const linked = await f.post(
            '/auth/discord/link',
            { code: 'victim-code', state },
            victim.cookie
        )
        expect(linked.statusCode).toBe(200)
        expect(linked.json().payload.user.externalIds).toEqual(['discord:victim-discord-id'])
        expect(f.exchangeCode).toHaveBeenCalledWith({
            code: 'victim-code',
            redirectUri: 'https://site.test/oauth/discord/link'
        })
        const replayed = await f.post(
            '/auth/discord/link',
            { code: 'victim-code', state },
            victim.cookie
        )
        expect(replayed.statusCode).toBe(400)
        expect(f.exchangeCode).toHaveBeenCalledTimes(1)
        expect(f.linkExternalAccount).toHaveBeenCalledTimes(1)
    })
})

describe('Discord login callbacks are bound to the browser that began them', () => {
    it('completes a login round trip through the attempt held in the session cookie', async () => {
        const f = await fixture()
        const { response: begun, state, cookie } = await f.begin('login')
        expect(begun.statusCode).toBe(200)
        expect(state).toMatch(/^login\.[0-9A-Za-z]{32}$/)
        expect(cookie).toBeDefined()
        expect(begun.json().payload.authorizationUrl).toContain(
            `redirect_uri=${encodeURIComponent('https://site.test/oauth/discord')}&state=${state}`
        )
        const login = await f.post('/auth/discord/login', { code: 'victim-code', state }, cookie)
        expect(login.statusCode).toBe(200)
        expect(login.json().payload.user.id).toBe('created-victim-discord-id')
        const session = f.cookieOf(login)
        expect(
            (await f.server.inject({ url: '/any', headers: { cookie: session } })).json()
        ).toMatchObject({ id: 'created-victim-discord-id' })
        expect(f.sessionStore.size).toBe(1)
    })

    it('rejects a login callback from a browser that did not begin the attempt', async () => {
        const f = await fixture()
        const attacker = await f.begin('login')
        const noCookie = await f.post('/auth/discord/login', {
            code: 'attacker-code',
            state: attacker.state
        })
        expect(noCookie.statusCode).toBe(400)
        const otherAttempt = await f.begin('login')
        const crossed = await f.post(
            '/auth/discord/login',
            { code: 'attacker-code', state: attacker.state },
            otherAttempt.cookie
        )
        expect(crossed.statusCode).toBe(400)
        expect(f.exchangeCode).not.toHaveBeenCalled()
        expect(f.handleExternalAuth).not.toHaveBeenCalled()
        expect(f.sessionStore.size).toBe(0)
    })

    it('rejects an unsolicited login code and a replayed login state', async () => {
        const f = await fixture()
        const bare = await f.post('/auth/discord/login', { code: 'attacker-code' })
        expect(bare.statusCode).toBe(400)
        const { state, cookie } = await f.begin('login')
        expect(
            (await f.post('/auth/discord/login', { code: 'victim-code', state }, cookie)).statusCode
        ).toBe(200)
        const replayed = await f.post('/auth/discord/login', { code: 'victim-code', state }, cookie)
        expect(replayed.statusCode).toBe(400)
        expect(f.exchangeCode).toHaveBeenCalledTimes(1)
    })

    it('refuses a callback when Discord does not confirm the code', async () => {
        const f = await fixture()
        const { state, cookie } = await f.begin('login')
        const response = await f.post(
            '/auth/discord/login',
            { code: 'unknown-code', state },
            cookie
        )
        expect(response.statusCode).toBe(401)
        expect(f.handleExternalAuth).not.toHaveBeenCalled()
        expect(f.sessionStore.size).toBe(0)
    })
})

describe('linking requires Recent Authentication', () => {
    it('refuses to begin or complete a link from a session without recent proof', async () => {
        const f = await fixture()
        const victim = await f.signIn('victim', 'challenge')
        const begun = await f.begin('link', victim.cookie)
        expect(begun.response.statusCode).toBe(403)
        expect(f.stateStore.size).toBe(0)
        const proved = await f.signIn('victim')
        const { state } = await f.begin('link', proved.cookie)
        f.advance(RECENT_AUTHENTICATION_SECONDS)
        const lapsed = await f.post(
            '/auth/discord/link',
            { code: 'victim-code', state },
            proved.cookie
        )
        expect(lapsed.statusCode).toBe(403)
        expect(victimLinks(f)).toEqual([])
    })

    it('lets a password reauthentication unlock linking for the same session', async () => {
        const f = await fixture()
        const victim = await f.signIn('victim', 'challenge')
        const wrong = await f.post(
            '/auth/reauthenticate',
            { password: 'not-the-password' },
            victim.cookie
        )
        expect(wrong.statusCode).toBe(401)
        expect((await f.begin('link', victim.cookie)).response.statusCode).toBe(403)
        const right = await f.post('/auth/reauthenticate', { password: PASSWORD }, victim.cookie)
        expect(right.statusCode).toBe(200)
        const { state } = await f.begin('link', victim.cookie)
        const linked = await f.post(
            '/auth/discord/link',
            { code: 'victim-code', state },
            victim.cookie
        )
        expect(linked.statusCode).toBe(200)
        expect(victimLinks(f)).toEqual(['discord:victim-discord-id'])
        const session = await f.sessionStore.find(victim.sessionId)
        expect(session?.authenticatedAt).toEqual(new Date('2026-10-27T12:00:00.000Z'))
    })

    it('does not treat a password reauthentication as a new sign-in', async () => {
        const f = await fixture()
        const victim = await f.signIn('victim', 'challenge')
        const before = await f.sessionStore.find(victim.sessionId)
        f.advance(60)
        const response = await f.post('/auth/reauthenticate', { password: PASSWORD }, victim.cookie)
        expect(response.statusCode).toBe(200)
        expect(response.cookies.find((cookie) => cookie.name === '__session')).toBeUndefined()
        const after = await f.sessionStore.find(victim.sessionId)
        expect(after?.expiresAt).toEqual(before?.expiresAt)
        expect(after?.authenticatedAt).toEqual(new Date('2026-10-27T12:01:00.000Z'))
        expect(f.sessionStore.size).toBe(1)
    })
})

describe('Discord reauthentication proves the signed-in Account only', () => {
    it('refreshes Recent Authentication through an identity linked to the Account', async () => {
        const f = await fixture()
        f.users.set('victim', {
            ...f.users.get('victim')!,
            externalIds: ['discord:victim-discord-id']
        })
        const victim = await f.signIn('victim', 'challenge')
        const { state } = await f.begin('reauthenticate', victim.cookie)
        expect(state).toMatch(/^reauthenticate\./)
        f.advance(30)
        const response = await f.post(
            '/auth/discord/reauthenticate',
            { code: 'victim-code', state },
            victim.cookie
        )
        expect(response.statusCode).toBe(200)
        const session = await f.sessionStore.find(victim.sessionId)
        expect(session?.authenticatedAt).toEqual(new Date('2026-10-27T12:00:30.000Z'))
        expect(f.linkExternalAccount).not.toHaveBeenCalled()
        expect(f.handleExternalAuth).not.toHaveBeenCalled()
    })

    it('rejects an identity that is not linked to the Account without linking or switching it', async () => {
        const f = await fixture()
        const victim = await f.signIn('victim', 'challenge')
        const { state } = await f.begin('reauthenticate', victim.cookie)
        const response = await f.post(
            '/auth/discord/reauthenticate',
            { code: 'attacker-code', state },
            victim.cookie
        )
        expect(response.statusCode).toBe(401)
        const session = await f.sessionStore.find(victim.sessionId)
        expect(session?.authenticatedAt).toBeUndefined()
        expect(victimLinks(f)).toEqual([])
        expect(f.linkExternalAccount).not.toHaveBeenCalled()
        expect(f.handleExternalAuth).not.toHaveBeenCalled()
        expect((await f.begin('link', victim.cookie)).response.statusCode).toBe(403)
    })

    it('rejects a reauthentication state presented as a link or by another session', async () => {
        const f = await fixture()
        f.users.set('victim', {
            ...f.users.get('victim')!,
            externalIds: ['discord:victim-discord-id']
        })
        const victim = await f.signIn('victim')
        const attacker = await f.signIn('attacker', 'challenge')
        const { state } = await f.begin('reauthenticate', victim.cookie)
        const asLink = await f.post(
            '/auth/discord/link',
            { code: 'victim-code', state },
            victim.cookie
        )
        expect(asLink.statusCode).toBe(400)
        const again = await f.begin('reauthenticate', victim.cookie)
        const crossed = await f.post(
            '/auth/discord/reauthenticate',
            { code: 'victim-code', state: again.state },
            attacker.cookie
        )
        expect(crossed.statusCode).toBe(400)
        expect(f.exchangeCode).not.toHaveBeenCalled()
        expect((await f.sessionStore.find(attacker.sessionId))?.authenticatedAt).toBeUndefined()
    })
})
