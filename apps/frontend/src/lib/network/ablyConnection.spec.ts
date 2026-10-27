import { afterEach, describe, expect, it, vi } from 'vitest'
import { type AblyTokenRequest, NotificationChannel } from '@tabletop/frontend-components'
import { AblyConnection } from './ablyConnection.svelte'
import { ChannelIdentifier } from './realtimeConnection'

type AuthCallback = (
    tokenParams: unknown,
    callback: (error: string | null, token: unknown) => void
) => Promise<void>

const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

const ably = vi.hoisted(() => {
    const settled = () => new Promise((resolve) => setTimeout(resolve, 0))
    class FakeChannel {
        state = 'initialized'
        subscribe = vi.fn(async () => {})
        attach = vi.fn(async () => {})
        on = vi.fn()
        constructor(readonly name: string) {}
    }
    class FakeRealtime {
        static latest: FakeRealtime
        readonly channelsByName = new Map<string, FakeChannel>()
        readonly connectedListeners: (() => unknown)[] = []
        readonly tokens: unknown[] = []
        readonly connection = {
            state: 'initialized',
            on: (event: string, listener: () => unknown) => {
                if (event === 'connected') this.connectedListeners.push(listener)
            }
        }
        readonly channels = {
            get: (name: string) => {
                const channel = this.channelsByName.get(name) ?? new FakeChannel(name)
                this.channelsByName.set(name, channel)
                return channel
            }
        }
        readonly auth = {
            authorize: vi.fn(async () => this.requestToken())
        }
        constructor(private readonly options: { authCallback: AuthCallback }) {
            FakeRealtime.latest = this
        }
        async requestToken() {
            await this.options.authCallback({}, (error, token) => {
                if (error) throw new Error(error)
                this.tokens.push(token)
            })
        }
        async connected() {
            await this.requestToken()
            this.connection.state = 'connected'
            this.emitConnected()
            await settled()
        }
        emitConnected() {
            for (const listener of this.connectedListeners) void listener()
        }
    }
    return { FakeRealtime }
})

vi.mock('ably', () => ({ default: { Realtime: ably.FakeRealtime } }))

afterEach(() => {
    vi.restoreAllMocks()
})

function tokenRequest(gameIds: string[]): AblyTokenRequest {
    return {
        keyName: 'app.key',
        nonce: 'nonce',
        mac: 'mac',
        timestamp: 0,
        capability: JSON.stringify(
            Object.fromEntries(gameIds.map((gameId) => [`game-${gameId}`, ['subscribe']]))
        )
    }
}

function fakeApi() {
    return {
        getAblyToken: vi.fn(async (gameIds: string[] = []) => tokenRequest(gameIds))
    }
}

async function connectionWithTwoChannels() {
    const api = fakeApi()
    const connection = new AblyConnection(api)
    await connection.addChannel(new ChannelIdentifier(NotificationChannel.User, 'user'))
    await connection.addChannel(new ChannelIdentifier(NotificationChannel.Global))
    const realtime = ably.FakeRealtime.latest
    const user = realtime.channels.get('user-user')
    const global = realtime.channels.get('global')
    return { api, connection, realtime, user, global }
}

const game = (id: string) => new ChannelIdentifier(NotificationChannel.GameInstance, id)

describe('requesting realtime grants', () => {
    it('asks for a token covering the game channels it holds', async () => {
        const { api, connection, realtime } = await connectionWithTwoChannels()
        await connection.addChannel(game('g1'))

        await realtime.connected()

        expect(api.getAblyToken).toHaveBeenCalledExactlyOnceWith(['g1'])
        expect(realtime.tokens).toEqual([tokenRequest(['g1'])])
        expect(realtime.channels.get('game-g1').subscribe).toHaveBeenCalledOnce()
    })

    it('renews the token before subscribing to a game added on a connected feed', async () => {
        const { api, connection, realtime } = await connectionWithTwoChannels()
        await realtime.connected()
        expect(api.getAblyToken).toHaveBeenCalledExactlyOnceWith([])
        const gameChannel = realtime.channels.get('game-g1')
        gameChannel.subscribe.mockImplementation(async () => {
            expect(realtime.tokens).toEqual([tokenRequest([]), tokenRequest(['g1'])])
        })

        await connection.addChannel(game('g1'))

        expect(realtime.auth.authorize).toHaveBeenCalledOnce()
        expect(api.getAblyToken).toHaveBeenLastCalledWith(['g1'])
        expect(gameChannel.subscribe).toHaveBeenCalledOnce()
    })

    it('keeps the token when the channels added are already granted', async () => {
        const api = fakeApi()
        const connection = new AblyConnection(api)
        const realtime = ably.FakeRealtime.latest
        await realtime.connected()

        await connection.addChannel(new ChannelIdentifier(NotificationChannel.User, 'user'))
        await connection.addChannel(new ChannelIdentifier(NotificationChannel.Global))

        expect(realtime.auth.authorize).not.toHaveBeenCalled()
        expect(api.getAblyToken).toHaveBeenCalledOnce()
        expect(realtime.channels.get('user-user').subscribe).toHaveBeenCalledOnce()
        expect(realtime.channels.get('global').subscribe).toHaveBeenCalledOnce()
    })

    it('renews a token issued before a game channel was added, then resubscribes', async () => {
        const { api, connection, realtime } = await connectionWithTwoChannels()
        await realtime.requestToken()
        await connection.addChannel(game('g1'))
        realtime.connection.state = 'connected'

        realtime.emitConnected()
        await settled()

        expect(realtime.auth.authorize).toHaveBeenCalledOnce()
        expect(api.getAblyToken).toHaveBeenLastCalledWith(['g1'])
        expect(realtime.channels.get('game-g1').subscribe).toHaveBeenCalledOnce()
    })

    it('reports a failed grant renewal and leaves the channels for the next connection', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { api, connection, realtime } = await connectionWithTwoChannels()
        await realtime.requestToken()
        await connection.addChannel(game('g1'))
        const failure = new Error('Token refused')
        api.getAblyToken.mockRejectedValueOnce(failure)
        realtime.auth.authorize.mockRejectedValueOnce(failure)
        realtime.connection.state = 'connected'

        realtime.emitConnected()
        await settled()

        expect(consoleError).toHaveBeenCalledWith('Failed to renew realtime grants', failure)
        expect(realtime.channels.get('game-g1').subscribe).not.toHaveBeenCalled()
    })
})

describe('resubscribing channels when the realtime feed connects', () => {
    it('stops quietly when the connection is closed while a channel is still subscribing', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const unhandled = vi.fn()
        process.on('unhandledRejection', unhandled)
        const { realtime, user, global } = await connectionWithTwoChannels()
        user.subscribe.mockImplementation(async () => {
            realtime.connection.state = 'closed'
            throw new Error('Connection closed')
        })

        await realtime.connected()
        process.off('unhandledRejection', unhandled)

        expect(unhandled).not.toHaveBeenCalled()
        expect(consoleError).not.toHaveBeenCalled()
        expect(global.subscribe).not.toHaveBeenCalled()
    })

    it('reports a channel that fails on an open connection and still resubscribes the rest', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { realtime, user, global } = await connectionWithTwoChannels()
        const failure = new Error('Channel denied')
        user.subscribe.mockRejectedValue(failure)

        await realtime.connected()

        expect(consoleError).toHaveBeenCalledWith(
            'Failed to resubscribe realtime channel user-user',
            failure
        )
        expect(global.subscribe).toHaveBeenCalledOnce()
    })
})
