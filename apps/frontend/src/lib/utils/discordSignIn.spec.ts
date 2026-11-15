import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertExists, Role, UserStatus, type User } from '@tabletop/common'

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
import {
    POPUP_CLOSE_GRACE_MS,
    POPUP_CLOSE_WATCH_MS,
    POPUP_START_TIMEOUT_MS,
    type DiscordAuthorizationApi,
    type DiscordAuthorizationResult
} from './discordAuthorization'
import type { DiscordAuthorizationStart } from '@tabletop/frontend-components'
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

const popup = {
    location: { href: 'about:blank' },
    closed: false,
    close: () => {
        popup.closed = true
    }
}
const otherTab = new BroadcastChannel('discord-authorization')
const fromPopup = (result: DiscordAuthorizationResult) => otherTab.postMessage(result)
const delivered = () => new Promise((resolve) => setImmediate(resolve))

beforeEach(() => {
    popup.location.href = 'about:blank'
    popup.closed = false
    reauthentication.cancel()
    vi.stubGlobal('window', { open: vi.fn(() => popup) })
    vi.stubGlobal('screen', { width: 1600, height: 900 })
    vi.stubGlobal('navigator', { userActivation: { isActive: true } })
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

// LoginPanel, the profile page and the notifications page mount DiscordSignIn without oncomplete:
// the app layout adopts the signed-in or linked user from the broadcast result instead.
function flowWithoutCallback(purpose: 'login' | 'link') {
    const { api, remote } = fakeApi()
    const report = vi.fn()
    const run = () => signInWithDiscord({ purpose, api: remote, report })
    return { api, report, run }
}

describe('closing the Discord window', () => {
    it.each(['login', 'link', 'reauthenticate'] as const)(
        'cancels %s without reporting an error or completing authentication',
        async (purpose) => {
            const { oncomplete, report, run } = flow(purpose)
            if (purpose === 'reauthenticate') {
                reauthentication.request({ description: 'add Google', retry: vi.fn() })
            }
            const confirmation = reauthentication.pending
            const pending = run()
            await delivered()
            popup.close()
            await vi.advanceTimersByTimeAsync(POPUP_CLOSE_WATCH_MS + POPUP_CLOSE_GRACE_MS)
            await pending
            expect(report).not.toHaveBeenCalled()
            expect(oncomplete).not.toHaveBeenCalled()
            expect(reauthentication.pending).toBe(confirmation)
            expect(reauthentication.confirmed).toBe(false)
            expect(vi.getTimerCount()).toBe(0)
        }
    )

    it('cancels the linking popup opened by Continue without rejecting the confirmation action', async () => {
        const { api, oncomplete, run } = flow('link')
        api.beginDiscordAuthorization.mockRejectedValueOnce(recentAuthenticationRequired())
        await run()
        const confirmation = reauthentication.pending
        assertExists(confirmation, 'Discord linking requested confirmation')
        await reauthentication.complete(confirmation)
        const pending = reauthentication.resume(confirmation)
        const outcome = pending.then(
            () => 'completed',
            () => 'rejected'
        )
        await delivered()
        popup.close()
        await vi.advanceTimersByTimeAsync(POPUP_CLOSE_WATCH_MS + POPUP_CLOSE_GRACE_MS)
        expect(await outcome).toBe('completed')
        expect(oncomplete).not.toHaveBeenCalled()
        expect(reauthentication.pending).toBeUndefined()
    })
})

describe('a button with no completion callback', () => {
    it('still begins the attempt, opens Discord and finishes a login', async () => {
        const { api, report, run } = flowWithoutCallback('login')
        const pending = run()
        await delivered()
        expect(api.beginDiscordAuthorization).toHaveBeenCalledWith('login')
        expect(popup.location.href).toContain('state=login.attempt-1')
        fromPopup({ state: 'login.attempt-1', purpose: 'login', outcome: 'success', user })
        await pending
        expect(report).not.toHaveBeenCalled()
    })

    it('still reports an attempt that is refused at begin', async () => {
        const { api, report, run } = flowWithoutCallback('login')
        api.beginDiscordAuthorization.mockRejectedValueOnce(new Error('synthetic begin failure'))
        await run()
        expect(api.beginDiscordAuthorization).toHaveBeenCalledTimes(1)
        expect(report).toHaveBeenCalledWith('synthetic begin failure')
    })

    it('still asks for confirmation when the link callback is refused, then links through a new attempt', async () => {
        const { api, report, run } = flowWithoutCallback('link')
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
        expect(report).not.toHaveBeenCalled()

        const confirmation = reauthentication.pending
        assertExists(confirmation, 'Discord linking requested confirmation')
        await reauthentication.complete(confirmation)
        const retried = reauthentication.resume(confirmation)
        await delivered()
        expect(api.beginDiscordAuthorization).toHaveBeenCalledTimes(2)
        expect(popup.location.href).toContain('state=link.attempt-2')
        fromPopup({ state: 'link.attempt-2', purpose: 'link', outcome: 'success', user })
        await retried
        expect(reauthentication.pending).toBeUndefined()
        expect(report).not.toHaveBeenCalled()
    })
})

describe('linking a Discord account', () => {
    it('waits for the server to allow linking before opening a window', async () => {
        const { api, run } = flow('link')
        const started = Promise.withResolvers<DiscordAuthorizationStart>()
        api.beginDiscordAuthorization.mockReturnValueOnce(started.promise)
        const pending = run()
        expect(window.open).not.toHaveBeenCalled()
        started.resolve({
            state: 'link.prepared',
            authorizationUrl: 'https://discord.test/authorize?state=link.prepared',
            expiresInSeconds: 600
        })
        await delivered()
        expect(window.open).toHaveBeenCalledTimes(1)
        expect(api.beginDiscordAuthorization).toHaveBeenCalledTimes(1)
        expect(popup.location.href).toContain('state=link.prepared')
        fromPopup({ state: 'link.prepared', purpose: 'link', outcome: 'success', user })
        await pending
    })

    it.each([false, undefined])(
        'offers Continue without another identity check when the browser cannot preserve the click: %s',
        async (isActive) => {
            vi.stubGlobal('navigator', {
                userActivation: isActive === undefined ? undefined : { isActive }
            })
            const { api, oncomplete, report, run } = flow('link')
            await run()
            expect(window.open).not.toHaveBeenCalled()
            expect(reauthentication.confirmed).toBe(true)
            const continuation = reauthentication.pending
            assertExists(continuation, 'The prepared link needs a fresh click')

            const pending = reauthentication.resume(continuation)
            expect(window.open).toHaveBeenCalledTimes(1)
            await delivered()
            expect(api.beginDiscordAuthorization).toHaveBeenCalledTimes(1)
            fromPopup({ state: 'link.attempt-1', purpose: 'link', outcome: 'success', user })
            await pending
            expect(oncomplete).toHaveBeenCalledTimes(1)
            expect(report).not.toHaveBeenCalled()
        }
    )

    it('rechecks an expired prepared attempt without opening a popup when proof has lapsed', async () => {
        vi.stubGlobal('navigator', { userActivation: { isActive: false } })
        const now = Date.now()
        const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
        try {
            const { api, report, run } = flow('link')
            await run()
            const ready = reauthentication.pending
            assertExists(ready, 'The link is ready for a click')
            clock.mockReturnValue(now + 600_000)
            api.beginDiscordAuthorization.mockRejectedValueOnce(recentAuthenticationRequired())
            await reauthentication.resume(ready)
            expect(window.open).not.toHaveBeenCalled()
            expect(api.beginDiscordAuthorization).toHaveBeenCalledTimes(2)
            expect(reauthentication.pending?.description).toBe(DISCORD_LINK_DESCRIPTION)
            expect(reauthentication.confirmed).toBe(false)
            expect(report).not.toHaveBeenCalled()
        } finally {
            clock.mockRestore()
        }
    })

    it('requests proof again if the callback of a prepared Continue is refused', async () => {
        vi.stubGlobal('navigator', { userActivation: { isActive: false } })
        const { run, report } = flow('link')
        await run()
        const ready = reauthentication.pending
        assertExists(ready, 'The link is ready for a click')
        const continuing = reauthentication.resume(ready)
        await delivered()
        fromPopup({
            state: 'link.attempt-1',
            purpose: 'link',
            outcome: 'error',
            error: { name: 'RecentAuthenticationRequiredError', message: 'Confirm again' }
        })
        await continuing
        expect(reauthentication.pending?.description).toBe(DISCORD_LINK_DESCRIPTION)
        expect(reauthentication.confirmed).toBe(false)
        expect(report).not.toHaveBeenCalled()
    })

    it.each(['allowed', 'confirmation-required'] as const)(
        'ignores a %s preparation response after the account or session changes',
        async (response) => {
            const { api, oncomplete, report, run } = flow('link')
            const started = Promise.withResolvers<DiscordAuthorizationStart>()
            api.beginDiscordAuthorization.mockReturnValueOnce(started.promise)
            const pending = run()
            reauthentication.cancel()
            if (response === 'allowed') {
                started.resolve({
                    state: 'link.old-account',
                    authorizationUrl: 'https://discord.test/authorize?state=link.old-account',
                    expiresInSeconds: 600
                })
            } else {
                started.reject(recentAuthenticationRequired())
            }
            await pending
            expect(window.open).not.toHaveBeenCalled()
            expect(reauthentication.pending).toBeUndefined()
            expect(oncomplete).not.toHaveBeenCalled()
            expect(report).not.toHaveBeenCalled()
        }
    )

    it('bounds a stalled preparation and ignores a late server answer', async () => {
        const { api, oncomplete, report, run } = flow('link')
        const started = Promise.withResolvers<DiscordAuthorizationStart>()
        api.beginDiscordAuthorization.mockReturnValueOnce(started.promise)
        const pending = run()
        await vi.advanceTimersByTimeAsync(POPUP_START_TIMEOUT_MS)
        await pending
        expect(report).toHaveBeenCalledWith('The Discord authorization could not start in time')
        started.resolve({
            state: 'link.late',
            authorizationUrl: 'https://discord.test/authorize?state=link.late',
            expiresInSeconds: 600
        })
        await delivered()
        expect(window.open).not.toHaveBeenCalled()
        expect(reauthentication.pending).toBeUndefined()
        expect(oncomplete).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
    })

    it('waits for a fresh click after confirmation before opening the linking popup', async () => {
        let userGesture = true
        const open = vi.fn(() => (userGesture ? popup : null))
        vi.stubGlobal('window', { open })
        const { api, run } = flow('link')
        api.beginDiscordAuthorization.mockRejectedValueOnce(recentAuthenticationRequired())
        await run()
        const confirmation = reauthentication.pending
        assertExists(confirmation, 'Discord linking requested confirmation')
        userGesture = false
        await reauthentication.complete(confirmation)
        expect(open).not.toHaveBeenCalled()
        expect(reauthentication.pending).toBe(confirmation)
        expect(reauthentication.confirmed).toBe(true)
        userGesture = true
        const retried = reauthentication.resume(confirmation)
        await delivered()
        expect(open).toHaveBeenCalledTimes(1)
        fromPopup({ state: 'link.attempt-1', purpose: 'link', outcome: 'success', user })
        await retried
        expect(reauthentication.pending).toBeUndefined()
    })

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

        const confirmation = reauthentication.pending
        assertExists(confirmation, 'Discord linking requested confirmation')
        await reauthentication.complete(confirmation)
        const retried = reauthentication.resume(confirmation)
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

    it('shows confirmation without flashing a popup when the attempt cannot begin', async () => {
        const { api, oncomplete, report, run } = flow('link')
        api.beginDiscordAuthorization.mockRejectedValueOnce(recentAuthenticationRequired())
        await run()
        expect(reauthentication.pending?.description).toBe(DISCORD_LINK_DESCRIPTION)
        expect(window.open).not.toHaveBeenCalled()
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
