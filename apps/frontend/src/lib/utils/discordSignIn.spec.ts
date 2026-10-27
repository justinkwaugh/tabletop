import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'

vi.mock('@tabletop/frontend-components', () => ({
    DISCORD_AUTHORIZATION_PURPOSES: ['login', 'link', 'reauthenticate'],
    APIError: class APIError extends Error {
        constructor({ name, message }: { name: string; message: string }) {
            super(message)
            this.name = name
        }
    }
}))
import { APIError } from '@tabletop/frontend-components'
import { reauthentication } from '$lib/stores/reauthentication.svelte'
import type { DiscordAuthorizationApi, DiscordAuthorizationResult } from './discordAuthorization'
import { DISCORD_LINK_DESCRIPTION, signInWithDiscord } from './discordSignIn'

const user: User = {
    id: 'account-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: ['discord:someone']
}

const recentAuthenticationRequired = () =>
    new APIError({
        name: 'RecentAuthenticationRequiredError',
        message: 'Recent authentication is required'
    })

function fakeApi() {
    let attempts = 0
    const api = {
        beginDiscordAuthorization: vi.fn(async (purpose: string) => {
            attempts += 1
            return {
                state: `${purpose}.attempt-${attempts}`,
                authorizationUrl: `https://discord.test/authorize?state=${purpose}.attempt-${attempts}`,
                expiresInSeconds: 600
            }
        }),
        loginDiscord: vi.fn(async () => user),
        linkDiscord: vi.fn(async () => user),
        reauthenticateDiscord: vi.fn(async () => {})
    }
    const remote: DiscordAuthorizationApi = api
    return { api, remote }
}

const popup = { location: { href: 'about:blank' }, closed: false, close: () => {} }
const otherTab = new BroadcastChannel('discord-authorization')
const fromPopup = (result: DiscordAuthorizationResult) => otherTab.postMessage(result)
const delivered = () => new Promise((resolve) => setImmediate(resolve))

beforeEach(() => {
    popup.location.href = 'about:blank'
    reauthentication.cancel()
    vi.stubGlobal('window', { open: vi.fn(() => popup) })
    vi.stubGlobal('screen', { width: 1600, height: 900 })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
})
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})
afterAll(() => otherTab.close())

function flow(purpose: 'login' | 'link' | 'reauthenticate') {
    const { api, remote } = fakeApi()
    const oncomplete = vi.fn()
    const report = vi.fn()
    const run = () => signInWithDiscord({ purpose, api: remote, oncomplete, report })
    return { api, oncomplete, report, run }
}

describe('linking a Discord account', () => {
    it('asks for confirmation when the callback is refused for want of Recent Authentication, then links through a new attempt', async () => {
        const { api, oncomplete, report, run } = flow('link')
        const first = run()
        await delivered()
        expect(popup.location.href).toContain('state=link.attempt-1')
        fromPopup({
            state: 'link.attempt-1',
            purpose: 'link',
            outcome: 'error',
            error: {
                name: 'RecentAuthenticationRequiredError',
                message: 'Recent authentication is required'
            }
        })
        await first
        expect(reauthentication.pending?.description).toBe(DISCORD_LINK_DESCRIPTION)
        expect(oncomplete).not.toHaveBeenCalled()
        expect(report).not.toHaveBeenCalled()

        const retried = reauthentication.complete()
        await delivered()
        expect(reauthentication.pending).toBeUndefined()
        expect(api.beginDiscordAuthorization).toHaveBeenCalledTimes(2)
        expect(popup.location.href).toContain('state=link.attempt-2')
        fromPopup({ state: 'link.attempt-1', purpose: 'link', outcome: 'success', user })
        fromPopup({ state: 'link.attempt-2', purpose: 'link', outcome: 'success', user })
        await retried
        expect(oncomplete).toHaveBeenCalledTimes(1)
        expect(oncomplete).toHaveBeenCalledWith(
            expect.objectContaining({ state: 'link.attempt-2', outcome: 'success', user })
        )
        expect(report).not.toHaveBeenCalled()
    })

    it('asks for confirmation the same way when the attempt cannot even begin', async () => {
        const { api, oncomplete, report, run } = flow('link')
        api.beginDiscordAuthorization.mockRejectedValueOnce(recentAuthenticationRequired())
        await run()
        expect(reauthentication.pending?.description).toBe(DISCORD_LINK_DESCRIPTION)
        expect(popup.location.href).toBe('about:blank')
        expect(oncomplete).not.toHaveBeenCalled()
        expect(report).not.toHaveBeenCalled()
    })

    it('reports any other refusal and completes nothing', async () => {
        const { oncomplete, report, run } = flow('link')
        const pending = run()
        await delivered()
        fromPopup({
            state: 'link.attempt-1',
            purpose: 'link',
            outcome: 'error',
            error: {
                name: 'InvalidOAuthStateError',
                message: 'The provider authorization does not belong to this request'
            }
        })
        await pending
        expect(report).toHaveBeenCalledWith(
            'The provider authorization does not belong to this request'
        )
        expect(reauthentication.pending).toBeUndefined()
        expect(oncomplete).not.toHaveBeenCalled()
    })
})

describe('signing in or confirming with Discord', () => {
    it('completes a successful login with the signed-in user', async () => {
        const { oncomplete, report, run } = flow('login')
        const pending = run()
        await delivered()
        fromPopup({ state: 'login.attempt-1', purpose: 'login', outcome: 'success', user })
        await pending
        expect(oncomplete).toHaveBeenCalledWith(
            expect.objectContaining({ purpose: 'login', outcome: 'success', user })
        )
        expect(report).not.toHaveBeenCalled()
    })

    it('reports a refusal outside linking instead of prompting for confirmation', async () => {
        const { api, oncomplete, report, run } = flow('reauthenticate')
        api.beginDiscordAuthorization.mockRejectedValueOnce(recentAuthenticationRequired())
        await run()
        expect(report).toHaveBeenCalledWith('Recent authentication is required')
        expect(reauthentication.pending).toBeUndefined()
        expect(oncomplete).not.toHaveBeenCalled()
    })
})
