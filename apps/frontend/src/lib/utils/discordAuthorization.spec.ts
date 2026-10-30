import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'
import {
    completeDiscordAuthorization,
    onDiscordAuthorizationResult,
    openDiscordAuthorization,
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
            state: `${purpose}-state`,
            authorizationUrl: `https://discord.test/authorize?state=${purpose}-state`,
            expiresInSeconds: LIFETIME_SECONDS
        })),
        loginDiscord: vi.fn(async () => user),
        linkDiscord: vi.fn(async () => user)
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
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})
afterAll(() => otherTab.close())

// Channel messages are delivered on the next turn of the event loop, which fake timers leave alone.
const delivered = () => new Promise((resolve) => setImmediate(resolve))

async function openAndStart(purpose: 'login' | 'link') {
    const popup = newPopup()
    const open = stubWindow(popup)
    const { api, remote } = fakeApi()
    const report = vi.fn()
    openDiscordAuthorization({ purpose, api: remote, report })
    await delivered()
    return { popup, open, api, report }
}

function expectNoLeakedListener() {
    expect(removeListener).toHaveBeenCalledTimes(addListener.mock.calls.length)
}

describe('opening a Discord authorization', () => {
    it('opens the popup during the click and points it at the issued authorization URL', async () => {
        const { popup, open, api, report } = await openAndStart('login')
        expect(open).toHaveBeenCalledWith(
            'about:blank',
            'Discord Authorization',
            expect.stringContaining('popup=true')
        )
        expect(api.beginDiscordAuthorization).toHaveBeenCalledWith('login')
        expect(popup.location.href).toBe('https://discord.test/authorize?state=login-state')
        fromPopup({ state: 'other-state', outcome: 'error', message: 'someone else' })
        await delivered()
        expect(report).not.toHaveBeenCalled()
        expect(removeListener).not.toHaveBeenCalled()
        fromPopup({ state: 'login-state', purpose: 'login', outcome: 'success', user })
        await delivered()
        expect(report).not.toHaveBeenCalled()
        expectNoLeakedListener()
    })

    it('reports the refusal the popup broadcast for its own attempt and stops listening', async () => {
        const { report } = await openAndStart('link')
        fromPopup({
            state: 'link-state',
            outcome: 'error',
            message: 'The provider authorization does not belong to this request'
        })
        await delivered()
        expect(report).toHaveBeenCalledWith(
            'The provider authorization does not belong to this request'
        )
        expectNoLeakedListener()
        fromPopup({ state: 'link-state', outcome: 'error', message: 'again' })
        await delivered()
        expect(report).toHaveBeenCalledTimes(1)
    })

    it('closes the popup and reports the refusal when the authorization cannot begin', async () => {
        const popup = newPopup()
        stubWindow(popup)
        const { api, remote } = fakeApi()
        api.beginDiscordAuthorization.mockRejectedValueOnce(new Error('No session found'))
        const report = vi.fn()
        openDiscordAuthorization({ purpose: 'link', api: remote, report })
        await delivered()
        expect(report).toHaveBeenCalledWith('No session found')
        expect(popup.closed).toBe(true)
        expect(popup.location.href).toBe('about:blank')
        expect(addListener).not.toHaveBeenCalled()
    })

    it('reports a blocked popup without contacting the server', () => {
        stubWindow(null)
        const { api, remote } = fakeApi()
        const report = vi.fn()
        openDiscordAuthorization({ purpose: 'login', api: remote, report })
        expect(report).toHaveBeenCalledWith('The browser blocked the Discord window')
        expect(api.beginDiscordAuthorization).not.toHaveBeenCalled()
    })

    it('neither navigates nor listens when the popup is closed while the attempt begins', async () => {
        const popup = newPopup()
        stubWindow(popup)
        const { api, remote } = fakeApi()
        let started: (
            value: Awaited<ReturnType<typeof api.beginDiscordAuthorization>>
        ) => void = () => {}
        api.beginDiscordAuthorization.mockReturnValueOnce(
            new Promise((resolve) => (started = resolve))
        )
        openDiscordAuthorization({ purpose: 'login', api: remote, report: vi.fn() })
        popup.close()
        started({
            state: 'login-state',
            authorizationUrl: 'https://discord.test/authorize?state=login-state',
            expiresInSeconds: LIFETIME_SECONDS
        })
        await delivered()
        expect(popup.location.href).toBe('about:blank')
        expect(addListener).not.toHaveBeenCalled()
    })

    it('stops listening once the server-side attempt has expired', async () => {
        const { report } = await openAndStart('link')
        expect(addListener).toHaveBeenCalledTimes(1)
        vi.advanceTimersByTime(LIFETIME_SECONDS * 1000 - 1)
        expect(removeListener).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1)
        expectNoLeakedListener()
        fromPopup({ state: 'link-state', outcome: 'error', message: 'late' })
        await delivered()
        expect(report).not.toHaveBeenCalled()
    })
})

describe('listening for results from another tab', () => {
    it('delivers results posted by the popup to every registered handler until it stops', async () => {
        const received: string[] = []
        const stop = onDiscordAuthorizationResult((result) => received.push(result.state))
        fromPopup({ state: 'one', purpose: 'link', outcome: 'success', user })
        otherTab.postMessage({ unrelated: true })
        otherTab.postMessage({ state: 'bad', outcome: 'error' })
        await delivered()
        stop()
        fromPopup({ state: 'two', purpose: 'link', outcome: 'success', user })
        await delivered()
        expect(received).toEqual(['one'])
    })
})

describe('completing a Discord callback', () => {
    it('ignores a callback that carries no state and never submits its code', async () => {
        const { api, remote } = fakeApi()
        await completeDiscordAuthorization({
            url: new URL('https://site.test/oauth/discord/link?code=attacker-code'),
            purpose: 'link',
            api: remote
        })
        await delivered()
        expect(api.linkDiscord).not.toHaveBeenCalled()
        expect(results).toEqual([])
    })

    it("submits code and state to the page's own route and broadcasts the outcome", async () => {
        const { api, remote } = fakeApi()
        await completeDiscordAuthorization({
            url: new URL('https://site.test/oauth/discord/link?code=victim-code&state=link-state'),
            purpose: 'link',
            api: remote
        })
        expect(api.linkDiscord).toHaveBeenCalledWith('victim-code', 'link-state')
        await completeDiscordAuthorization({
            url: new URL('https://site.test/oauth/discord?code=victim-code&state=login-state'),
            purpose: 'login',
            api: remote
        })
        expect(api.loginDiscord).toHaveBeenCalledWith('victim-code', 'login-state')
        await delivered()
        expect(results).toEqual([
            { state: 'link-state', purpose: 'link', outcome: 'success', user },
            { state: 'login-state', purpose: 'login', outcome: 'success', user }
        ])
    })

    it('broadcasts a refusal from the server for the initiating tab to report', async () => {
        const { api, remote } = fakeApi()
        api.linkDiscord.mockRejectedValueOnce(
            new Error('The provider authorization does not belong to this request')
        )
        await completeDiscordAuthorization({
            url: new URL('https://site.test/oauth/discord/link?code=victim-code&state=link-state'),
            purpose: 'link',
            api: remote
        })
        await delivered()
        expect(results).toEqual([
            {
                state: 'link-state',
                outcome: 'error',
                message: 'The provider authorization does not belong to this request'
            }
        ])
    })

    it('reports a denied authorization without calling the server', async () => {
        const { api, remote } = fakeApi()
        await completeDiscordAuthorization({
            url: new URL(
                'https://site.test/oauth/discord?error=access_denied&error_description=Denied&state=login-state'
            ),
            purpose: 'login',
            api: remote
        })
        await delivered()
        expect(api.loginDiscord).not.toHaveBeenCalled()
        expect(results).toEqual([{ state: 'login-state', outcome: 'error', message: 'Denied' }])
    })
})
