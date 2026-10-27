import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Role, UserStatus, type User } from '@tabletop/common'

vi.mock('@tabletop/frontend-components', () => ({
    DISCORD_AUTHORIZATION_PURPOSES: ['login', 'link', 'reauthenticate']
}))
import {
    completeDiscordAuthorization,
    DiscordAuthorizationError,
    onDiscordAuthorizationResult,
    openDiscordAuthorization,
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

type Popup = { location: { href: string }; close: () => void; closed: boolean }

function fakeApi() {
    const api = {
        beginDiscordAuthorization: vi.fn(async (purpose: string) => ({
            state: `${purpose}.nonce`,
            authorizationUrl: `https://discord.test/authorize?state=${purpose}.nonce`
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

beforeEach(() => {
    results.length = 0
})
afterEach(() => {
    vi.unstubAllGlobals()
})
afterAll(() => otherTab.close())

const settled = () => new Promise((resolve) => setTimeout(resolve, 20))

describe('opening a Discord authorization', () => {
    it('opens the popup during the click and points it at the issued authorization URL', async () => {
        const popup = newPopup()
        const open = stubWindow(popup)
        const { api, remote } = fakeApi()
        const pending = openDiscordAuthorization({ purpose: 'login', api: remote })
        expect(open).toHaveBeenCalledWith(
            'about:blank',
            'Discord Authorization',
            expect.stringContaining('popup=true')
        )
        await settled()
        expect(api.beginDiscordAuthorization).toHaveBeenCalledWith('login')
        expect(popup.location.href).toBe('https://discord.test/authorize?state=login.nonce')
        fromPopup({ state: 'other.nonce', outcome: 'error', message: 'someone else' })
        fromPopup({ state: 'login.nonce', purpose: 'login', outcome: 'success', user })
        await expect(pending).resolves.toMatchObject({ state: 'login.nonce', outcome: 'success' })
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
    })

    it('reports a blocked popup without contacting the server', async () => {
        stubWindow(null)
        const { api, remote } = fakeApi()
        await expect(
            openDiscordAuthorization({ purpose: 'login', api: remote })
        ).rejects.toBeInstanceOf(DiscordAuthorizationError)
        expect(api.beginDiscordAuthorization).not.toHaveBeenCalled()
    })
})

describe('listening for results from another tab', () => {
    it('delivers results posted by the popup to every registered handler until it stops', async () => {
        const received: string[] = []
        const stop = onDiscordAuthorizationResult((result) => received.push(result.state))
        fromPopup({ state: 'link.one', purpose: 'link', outcome: 'success', user })
        otherTab.postMessage({ unrelated: true })
        await settled()
        stop()
        fromPopup({ state: 'link.two', purpose: 'link', outcome: 'success', user })
        await settled()
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
        await settled()
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
        await settled()
        expect(results.map((result) => [result.state, result.outcome])).toEqual([
            ['link.nonce', 'success'],
            ['login.nonce', 'success'],
            ['reauthenticate.nonce', 'success']
        ])
    })

    it('broadcasts a refusal from the server for the initiating tab to show', async () => {
        const { api, remote } = fakeApi()
        api.linkDiscord.mockRejectedValueOnce(
            new Error('The provider authorization does not belong to this request')
        )
        await completeDiscordAuthorization({
            url: new URL(
                'https://site.test/oauth/discord/link?code=attacker-code&state=link.nonce'
            ),
            api: remote
        })
        await settled()
        expect(results).toEqual([
            {
                state: 'link.nonce',
                purpose: 'link',
                outcome: 'error',
                message: 'The provider authorization does not belong to this request'
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
        await settled()
        expect(api.loginDiscord).not.toHaveBeenCalled()
        expect(results.map((result) => result.outcome)).toEqual(['error', 'error'])
        expect(purposeOfState('admin.nonce')).toBeUndefined()
        expect(purposeOfState('link.nonce')).toBe('link')
    })
})
