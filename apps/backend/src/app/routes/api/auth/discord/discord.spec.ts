import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OAUTH_STATE_LIFETIME_SECONDS } from '@tabletop/backend-services'

vi.hoisted(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop')
    vi.stubEnv('FRONTEND_HOST', 'https://site.test')
})
import { closing, discordFixture, type DiscordFixture } from '../../../../tests/discordFixture.js'

const REFUSED_STATE = 'The provider authorization does not belong to this request'
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
            { code: 'attacker-code', state: '0123456789abcdefghijklmnopqrstuv' },
            cookie
        )
        expect(response.statusCode).toBe(400)
        expect(f.exchangeCode).not.toHaveBeenCalled()
        expect(victimLinks(f)).toEqual([])
    })

    it('rejects a link state that another session began and leaves that attempt alone', async () => {
        const f = await fixture()
        const attacker = await f.signIn('attacker')
        const victim = await f.signIn('victim')
        const { state } = await f.begin('link', attacker.cookie)
        expect(state).toMatch(/^[0-9A-Za-z]{32}$/)
        const injected = await f.post(
            '/auth/discord/link',
            { code: 'attacker-code', state },
            victim.cookie
        )
        expect(injected.statusCode).toBe(400)
        expect(injected.json().message).toBe(REFUSED_STATE)
        expect(victimLinks(f)).toEqual([])
        expect(f.exchangeCode).not.toHaveBeenCalled()
        expect((await f.sessionStore.find(victim.sessionId))?.providerAuthorization).toBeUndefined()
        expect(
            (await f.sessionStore.find(attacker.sessionId))?.providerAuthorization
        ).toMatchObject({ state, purpose: 'link' })
    })

    it('records the attempt on the Authenticated Session that began it', async () => {
        const f = await fixture()
        const victim = await f.signIn('victim')
        const before = await f.sessionStore.find(victim.sessionId)
        expect(before?.providerAuthorization).toBeUndefined()
        const { state, cookie } = await f.begin('link', victim.cookie)
        expect(cookie).toBe(victim.cookie)
        expect(await f.sessionStore.find(victim.sessionId)).toEqual({
            ...before,
            providerAuthorization: {
                provider: 'discord',
                purpose: 'link',
                redirectUri: 'https://site.test/oauth/discord/link',
                state,
                expiresAt: new Date('2026-10-27T12:10:00.000Z')
            }
        })
    })

    it('replaces an earlier attempt, and a stale callback leaves the newer attempt usable', async () => {
        const f = await fixture()
        const victim = await f.signIn('victim')
        const earlier = await f.begin('link', victim.cookie)
        const later = await f.begin('link', victim.cookie)
        expect(later.state).not.toBe(earlier.state)
        const stale = await f.post(
            '/auth/discord/link',
            { code: 'attacker-code', state: earlier.state },
            victim.cookie
        )
        expect(stale.statusCode).toBe(400)
        expect(f.exchangeCode).not.toHaveBeenCalled()
        expect((await f.sessionStore.find(victim.sessionId))?.providerAuthorization?.state).toBe(
            later.state
        )
        const linked = await f.post(
            '/auth/discord/link',
            { code: 'victim-code', state: later.state },
            victim.cookie
        )
        expect(linked.statusCode).toBe(200)
        expect(victimLinks(f)).toEqual(['discord:victim-discord-id'])
        expect((await f.sessionStore.find(victim.sessionId))?.providerAuthorization).toBeUndefined()
    })

    it('fails closed before Discord when the session record cannot be updated', async () => {
        const f = await fixture()
        const victim = await f.signIn('victim')
        const { state } = await f.begin('link', victim.cookie)
        vi.spyOn(f.sessionStore, 'update').mockRejectedValueOnce(new Error('store unavailable'))
        const response = await f.post(
            '/auth/discord/link',
            { code: 'victim-code', state },
            victim.cookie
        )
        expect(response.statusCode).toBe(500)
        expect(f.exchangeCode).not.toHaveBeenCalled()
        expect(victimLinks(f)).toEqual([])
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

    it('completes a link once and rejects the replay', async () => {
        const f = await fixture()
        const victim = await f.signIn('victim')
        const { state, response: begun } = await f.begin('link', victim.cookie)
        expect(begun.json().payload.authorizationUrl).toBe(
            `https://discord.test/authorize?redirect_uri=${encodeURIComponent('https://site.test/oauth/discord/link')}&state=${state}`
        )
        expect(begun.json().payload.expiresInSeconds).toBe(OAUTH_STATE_LIFETIME_SECONDS)
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
        expect(state).toMatch(/^[0-9A-Za-z]{32}$/)
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

    it('rejects an unsolicited login code and a state replayed with the signed-in cookie', async () => {
        const f = await fixture()
        const bare = await f.post('/auth/discord/login', { code: 'attacker-code' })
        expect(bare.statusCode).toBe(400)
        const { state, cookie } = await f.begin('login')
        const login = await f.post('/auth/discord/login', { code: 'victim-code', state }, cookie)
        expect(login.statusCode).toBe(200)
        const replayed = await f.post(
            '/auth/discord/login',
            { code: 'victim-code', state },
            f.cookieOf(login)
        )
        expect(replayed.statusCode).toBe(400)
        expect(f.exchangeCode).toHaveBeenCalledTimes(1)
    })

    it('rejects a login attempt after its lifetime', async () => {
        const f = await fixture()
        const { state, cookie } = await f.begin('login')
        f.advance(OAUTH_STATE_LIFETIME_SECONDS)
        const response = await f.post('/auth/discord/login', { code: 'victim-code', state }, cookie)
        expect(response.statusCode).toBe(400)
        expect(response.json().message).toBe(REFUSED_STATE)
        expect(f.exchangeCode).not.toHaveBeenCalled()
        expect(f.sessionStore.size).toBe(0)
    })

    it('replaces an earlier login attempt held by the same browser', async () => {
        const f = await fixture()
        const earlier = await f.begin('login')
        const later = await f.begin('login', earlier.cookie)
        const stale = await f.post(
            '/auth/discord/login',
            { code: 'victim-code', state: earlier.state },
            later.cookie
        )
        expect(stale.statusCode).toBe(400)
        const login = await f.post(
            '/auth/discord/login',
            { code: 'victim-code', state: later.state },
            later.cookie
        )
        expect(login.statusCode).toBe(200)
    })

    // A cookie-held attempt is cleared by the response that completes it, not globally: a copy of the
    // cookie from before that response still carries it, so only Discord's single-use code stops a
    // second sign-in from the same state.
    it('leaves a pre-completion copy of the cookie to the single use of the Discord code', async () => {
        const f = await fixture()
        const { state, cookie } = await f.begin('login')
        const [first, second] = await Promise.all([
            f.post('/auth/discord/login', { code: 'victim-code', state }, cookie),
            f.post('/auth/discord/login', { code: 'victim-code', state }, cookie)
        ])
        expect([first.statusCode, second.statusCode].sort()).toEqual([200, 401])
        const copied = await f.post('/auth/discord/login', { code: 'victim-code', state }, cookie)
        expect(copied.statusCode).toBe(401)
        expect(f.exchangeCode).toHaveBeenCalledTimes(3)
        expect(f.sessionStore.size).toBe(1)
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
