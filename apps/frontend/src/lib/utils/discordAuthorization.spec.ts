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
import {
    completeDiscordAuthorization,
    DiscordAuthorizationError,
    onDiscordAuthorizationResult,
    openDiscordAuthorization,
    POPUP_CLOSE_GRACE_MS,
    POPUP_CLOSE_WATCH_MS,
    purposeOfState,
    type DiscordAuthorizationApi,
    type DiscordAuthorizationResult
} from './discordAuthorization'

const user: User = {
    id: 'account-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

const LIFETIME_SECONDS = 600

type Popup = { location: { href: string }; close: () => void; closed: boolean }

function fakeApi() {
    const api = {
        beginDiscordAuthorization: vi.fn(async (purpose: string) => ({
            state: `${purpose}.nonce`,
            authorizationUrl: `https://discord.test/authorize?state=${purpose}.nonce`,
            expiresInSeconds: LIFETIME_SECONDS
        })),
        loginDiscord: vi.fn(async () => user),
        linkDiscord: vi.fn(async () => user),
        reauthenticateDiscord: vi.fn(async () => {})
    }
    const remote: DiscordAuthorizationApi = api
    return { api, remote }
}

function stubWindow(popup: Popup | null) {
    const open = vi.fn(() => popup)
    vi.stubGlobal('window', { open })
    vi.stubGlobal('screen', { width: 1600, height: 900 })
    return open
}

function newPopup(): Popup {
    const popup: Popup = {
        location: { href: 'about:blank' },
        closed: false,
        close: () => (popup.closed = true)
    }
    return popup
}

// A BroadcastChannel never receives its own messages, so this second channel plays the other tab:
// it hears what this tab broadcasts and can post what the popup would.
const otherTab = new BroadcastChannel('discord-authorization')
const results: DiscordAuthorizationResult[] = []
otherTab.onmessage = (event) => results.push(event.data)
const fromPopup = (result: DiscordAuthorizationResult) => otherTab.postMessage(result)

const addListener = vi.spyOn(BroadcastChannel.prototype, 'addEventListener')
const removeListener = vi.spyOn(BroadcastChannel.prototype, 'removeEventListener')

beforeEach(() => {
    results.length = 0
    addListener.mockClear()
    removeListener.mockClear()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
})
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})
afterAll(() => otherTab.close())

// Channel messages are delivered on the next turn of the event loop, which fake timers leave alone.
const delivered = () => new Promise((resolve) => setImmediate(resolve))

async function openAndStart(purpose: 'login' | 'link' | 'reauthenticate') {
    const popup = newPopup()
    const open = stubWindow(popup)
    const { api, remote } = fakeApi()
    const pending = openDiscordAuthorization({ purpose, api: remote })
    await delivered()
    return { popup, open, api, pending }
}

function expectNoLeakedListener() {
    expect(removeListener).toHaveBeenCalledTimes(addListener.mock.calls.length)
}

describe('opening a Discord authorization', () => {
    it('opens the popup during the click and points it at the issued authorization URL', async () => {
        const { popup, open, api, pending } = await openAndStart('login')
        expect(open).toHaveBeenCalledWith(
            'about:blank',
            'Discord Authorization',
            expect.stringContaining('popup=true')
        )
        expect(api.beginDiscordAuthorization).toHaveBeenCalledWith('login')
        expect(popup.location.href).toBe('https://discord.test/authorize?state=login.nonce')
        fromPopup({
            state: 'other.nonce',
            outcome: 'error',
            error: { name: 'Error', message: 'someone else' }
        })
        fromPopup({ state: 'login.nonce', purpose: 'login', outcome: 'success', user })
        await expect(pending).resolves.toMatchObject({ state: 'login.nonce', outcome: 'success' })
        expectNoLeakedListener()
    })

    it('rejects with the error the popup reported, keeping its name', async () => {
        const { pending } = await openAndStart('link')
        fromPopup({
            state: 'link.nonce',
            purpose: 'link',
            outcome: 'error',
            error: {
                name: 'RecentAuthenticationRequiredError',
                message: 'Recent authentication is required'
            }
        })
        const error = await pending.catch((caught: unknown) => caught)
        expect(error).toBeInstanceOf(APIError)
        expect(error).toMatchObject({
            name: 'RecentAuthenticationRequiredError',
            message: 'Recent authentication is required'
        })
        expectNoLeakedListener()
    })

    it('rebuilds a refusal raised by the popup itself as a DiscordAuthorizationError', async () => {
        const { pending } = await openAndStart('login')
        fromPopup({
            state: 'login.nonce',
            outcome: 'error',
            error: { name: 'DiscordAuthorizationError', message: 'Denied' }
        })
        await expect(pending).rejects.toBeInstanceOf(DiscordAuthorizationError)
    })

    it('closes the popup and reports the refusal when the authorization cannot begin', async () => {
        const popup = newPopup()
        stubWindow(popup)
        const { api, remote } = fakeApi()
        api.beginDiscordAuthorization.mockRejectedValueOnce(
            new Error('RecentAuthenticationRequired')
        )
        await expect(openDiscordAuthorization({ purpose: 'link', api: remote })).rejects.toThrow(
            'RecentAuthenticationRequired'
        )
        expect(popup.closed).toBe(true)
        expect(popup.location.href).toBe('about:blank')
        expect(addListener).not.toHaveBeenCalled()
    })

    it('reports a blocked popup without contacting the server', async () => {
        stubWindow(null)
        const { api, remote } = fakeApi()
        await expect(
            openDiscordAuthorization({ purpose: 'login', api: remote })
        ).rejects.toBeInstanceOf(DiscordAuthorizationError)
        expect(api.beginDiscordAuthorization).not.toHaveBeenCalled()
    })

    it('gives up without navigating or listening when the popup is closed while the attempt begins', async () => {
        const popup = newPopup()
        stubWindow(popup)
        const { api, remote } = fakeApi()
        let begun: (start: {
            state: string
            authorizationUrl: string
            expiresInSeconds: number
        }) => void = () => {}
        api.beginDiscordAuthorization.mockImplementationOnce(
            () => new Promise((resolve) => (begun = resolve))
        )
        const pending = openDiscordAuthorization({ purpose: 'login', api: remote })
        await delivered()
        popup.close()
        begun({
            state: 'login.nonce',
            authorizationUrl: 'https://discord.test/authorize',
            expiresInSeconds: LIFETIME_SECONDS
        })
        await expect(pending).rejects.toThrow('The Discord window was closed')
        expect(popup.location.href).toBe('about:blank')
        expect(addListener).not.toHaveBeenCalled()
        expect(vi.getTimerCount()).toBe(0)
    })

    it('settles once as abandoned when the popup is closed and nothing arrives in the grace period', async () => {
        const { popup, pending } = await openAndStart('link')
        const outcome = vi.fn()
        pending.then(outcome, outcome)
        popup.close()
        await vi.advanceTimersByTimeAsync(POPUP_CLOSE_WATCH_MS + POPUP_CLOSE_GRACE_MS - 1)
        expect(outcome).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(1)
        await expect(pending).rejects.toThrow('The Discord window was closed')
        expect(vi.getTimerCount()).toBe(0)
        expectNoLeakedListener()
        fromPopup({ state: 'link.nonce', purpose: 'link', outcome: 'success', user })
        await delivered()
        await vi.advanceTimersByTimeAsync(POPUP_CLOSE_GRACE_MS)
        expect(outcome).toHaveBeenCalledTimes(1)
    })

    it('still succeeds when the popup closes right after broadcasting its result', async () => {
        const { popup, pending } = await openAndStart('reauthenticate')
        popup.close()
        await vi.advanceTimersByTimeAsync(POPUP_CLOSE_WATCH_MS)
        fromPopup({ state: 'reauthenticate.nonce', purpose: 'reauthenticate', outcome: 'success' })
        await expect(pending).resolves.toMatchObject({ outcome: 'success' })
        expect(vi.getTimerCount()).toBe(0)
        expectNoLeakedListener()
    })

    it('abandons the attempt and closes the popup once the server-side attempt has expired', async () => {
        const { popup, pending } = await openAndStart('login')
        const abandoned = expect(pending).rejects.toThrow('took too long')
        await vi.advanceTimersByTimeAsync(LIFETIME_SECONDS * 1000 - 1)
        expect(popup.closed).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
        await abandoned
        expect(popup.closed).toBe(true)
        expect(vi.getTimerCount()).toBe(0)
        expectNoLeakedListener()
    })
})

describe('listening for results from another tab', () => {
    it('delivers results posted by the popup to every registered handler until it stops', async () => {
        const received: string[] = []
        const stop = onDiscordAuthorizationResult((result) => received.push(result.state))
        fromPopup({ state: 'link.one', purpose: 'link', outcome: 'success', user })
        otherTab.postMessage({ unrelated: true })
        otherTab.postMessage({ state: 'link.bad', outcome: 'error' })
        await delivered()
        stop()
        fromPopup({ state: 'link.two', purpose: 'link', outcome: 'success', user })
        await delivered()
        expect(received).toEqual(['link.one'])
    })
})

describe('completing a Discord callback', () => {
    it('ignores a callback that carries no state and never submits its code', async () => {
        const { api, remote } = fakeApi()
        await completeDiscordAuthorization({
            url: new URL('https://site.test/oauth/discord/link?code=attacker-code'),
            api: remote
        })
        await delivered()
        expect(api.linkDiscord).not.toHaveBeenCalled()
        expect(api.loginDiscord).not.toHaveBeenCalled()
        expect(results).toEqual([])
    })

    it('submits code and state to the route named by the state and broadcasts the outcome', async () => {
        const { api, remote } = fakeApi()
        await completeDiscordAuthorization({
            url: new URL('https://site.test/oauth/discord/link?code=victim-code&state=link.nonce'),
            api: remote
        })
        expect(api.linkDiscord).toHaveBeenCalledWith('victim-code', 'link.nonce')
        await completeDiscordAuthorization({
            url: new URL('https://site.test/oauth/discord?code=victim-code&state=login.nonce'),
            api: remote
        })
        expect(api.loginDiscord).toHaveBeenCalledWith('victim-code', 'login.nonce')
        await completeDiscordAuthorization({
            url: new URL(
                'https://site.test/oauth/discord/link?code=victim-code&state=reauthenticate.nonce'
            ),
            api: remote
        })
        expect(api.reauthenticateDiscord).toHaveBeenCalledWith(
            'victim-code',
            'reauthenticate.nonce'
        )
        await delivered()
        expect(results.map((result) => [result.state, result.outcome])).toEqual([
            ['link.nonce', 'success'],
            ['login.nonce', 'success'],
            ['reauthenticate.nonce', 'success']
        ])
    })

    it('broadcasts a refusal from the server with its name for the initiating tab to act on', async () => {
        const { api, remote } = fakeApi()
        api.linkDiscord.mockRejectedValueOnce(
            new APIError({
                name: 'RecentAuthenticationRequiredError',
                message: 'Recent authentication is required'
            })
        )
        await completeDiscordAuthorization({
            url: new URL('https://site.test/oauth/discord/link?code=victim-code&state=link.nonce'),
            api: remote
        })
        await delivered()
        expect(results).toEqual([
            {
                state: 'link.nonce',
                purpose: 'link',
                outcome: 'error',
                error: {
                    name: 'RecentAuthenticationRequiredError',
                    message: 'Recent authentication is required'
                }
            }
        ])
    })

    it('reports a denied authorization or an unknown purpose without calling the server', async () => {
        const { api, remote } = fakeApi()
        await completeDiscordAuthorization({
            url: new URL(
                'https://site.test/oauth/discord?error=access_denied&error_description=Denied&state=login.nonce'
            ),
            api: remote
        })
        await completeDiscordAuthorization({
            url: new URL('https://site.test/oauth/discord?code=victim-code&state=admin.nonce'),
            api: remote
        })
        await delivered()
        expect(api.loginDiscord).not.toHaveBeenCalled()
        expect(results.map((result) => result.outcome)).toEqual(['error', 'error'])
        expect(results[0]).toMatchObject({
            error: { name: 'DiscordAuthorizationError', message: 'Denied' }
        })
        expect(purposeOfState('admin.nonce')).toBeUndefined()
        expect(purposeOfState('link.nonce')).toBe('link')
    })
})
