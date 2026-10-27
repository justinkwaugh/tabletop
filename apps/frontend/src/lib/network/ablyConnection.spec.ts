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
        subscribe = vi.fn(async () => {
            this.state = 'attaching'
        })
        attach = vi.fn(async () => {})
        detach = vi.fn(async () => {})
        unsubscribe = vi.fn()
        on = vi.fn()
        off = vi.fn()
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

class Gate<T = void> {
    readonly promise: Promise<T>
    open: (value: T) => void = () => {}
    constructor() {
        this.promise = new Promise<T>((resolve) => {
            this.open = resolve
        })
    }
}

async function connectedWithGame(gameId: string) {
    const { api, connection, realtime } = await connectionWithTwoChannels()
    await connection.addChannel(game(gameId))
    await realtime.connected()
    const gameChannel = realtime.channels.get(`game-${gameId}`)
    expect(gameChannel.subscribe).toHaveBeenCalledOnce()
    return { api, connection, realtime, gameChannel }
}

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

describe('removing a channel while it is still being authorized or detached', () => {
    it('does not subscribe a channel removed while its grants are being authorized', async () => {
        const { api, connection, realtime } = await connectionWithTwoChannels()
        await realtime.connected()
        const token = new Gate<AblyTokenRequest>()
        api.getAblyToken.mockReturnValueOnce(token.promise)
        const gameChannel = realtime.channels.get('game-g1')

        const adding = connection.addChannel(game('g1'))
        await settled()
        expect(api.getAblyToken).toHaveBeenLastCalledWith(['g1'])
        const removing = connection.removeChannel(game('g1'))
        token.open(tokenRequest(['g1']))
        await Promise.all([adding, removing])

        expect(gameChannel.subscribe).not.toHaveBeenCalled()
        expect(gameChannel.attach).not.toHaveBeenCalled()
        expect(gameChannel.off).toHaveBeenCalledOnce()
        expect(gameChannel.unsubscribe).toHaveBeenCalledOnce()
        expect(gameChannel.detach).toHaveBeenCalledOnce()
    })

    it('does not resubscribe on reconnect a channel whose removal is still detaching', async () => {
        const { api, connection, realtime } = await connectionWithTwoChannels()
        await realtime.requestToken()
        await connection.addChannel(game('g1'))
        const gameChannel = realtime.channels.get('game-g1')
        const detached = new Gate()
        gameChannel.detach.mockReturnValueOnce(detached.promise)
        const token = new Gate<AblyTokenRequest>()
        api.getAblyToken.mockReturnValueOnce(token.promise)
        realtime.connection.state = 'connected'

        realtime.emitConnected()
        await settled()
        expect(api.getAblyToken).toHaveBeenLastCalledWith(['g1'])
        const removing = connection.removeChannel(game('g1'))
        token.open(tokenRequest(['g1']))
        await settled()
        detached.open()
        await removing

        expect(gameChannel.subscribe).not.toHaveBeenCalled()
        expect(gameChannel.attach).not.toHaveBeenCalled()
        expect(realtime.channels.get('user-user').subscribe).toHaveBeenCalledOnce()
        expect(realtime.channels.get('global').subscribe).toHaveBeenCalledOnce()
    })

    it('subscribes a channel added again once its pending removal has detached', async () => {
        const { api, connection, realtime, gameChannel } = await connectedWithGame('g1')
        const detached = new Gate()
        gameChannel.detach.mockReturnValueOnce(detached.promise)

        const removing = connection.removeChannel(game('g1'))
        const adding = connection.addChannel(game('g1'))
        await settled()
        expect(gameChannel.subscribe).toHaveBeenCalledOnce()
        detached.open()
        await Promise.all([removing, adding])

        expect(gameChannel.subscribe).toHaveBeenCalledTimes(2)
        expect(gameChannel.unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
            gameChannel.subscribe.mock.invocationCallOrder[1]
        )
        expect(realtime.auth.authorize).not.toHaveBeenCalled()
        expect(api.getAblyToken).toHaveBeenCalledOnce()

        await connection.removeChannel(game('g1'))
        expect(gameChannel.detach).toHaveBeenCalledTimes(2)
    })

    it('keeps a channel re-added while an earlier addition is still being authorized', async () => {
        const { api, connection, realtime } = await connectionWithTwoChannels()
        await realtime.connected()
        const token = new Gate<AblyTokenRequest>()
        api.getAblyToken.mockReturnValueOnce(token.promise)
        const gameChannel = realtime.channels.get('game-g1')

        const adding = connection.addChannel(game('g1'))
        await settled()
        await connection.removeChannel(game('g1'))
        const addingAgain = connection.addChannel(game('g1'))
        await settled()
        token.open(tokenRequest(['g1']))
        await Promise.all([adding, addingAgain])

        expect(gameChannel.subscribe).toHaveBeenCalledOnce()
        expect(gameChannel.unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
            gameChannel.subscribe.mock.invocationCallOrder[0]
        )

        await connection.removeChannel(game('g1'))
        expect(gameChannel.detach).toHaveBeenCalledTimes(2)
    })

    it('waits on reconnect for the pending removal before subscribing a channel added again', async () => {
        const { api, connection, realtime, gameChannel } = await connectedWithGame('g1')
        const detached = new Gate()
        gameChannel.detach.mockReturnValueOnce(detached.promise)

        const removing = connection.removeChannel(game('g1'))
        const adding = connection.addChannel(game('g1'))
        realtime.emitConnected()
        await settled()
        expect(gameChannel.subscribe).toHaveBeenCalledOnce()
        detached.open()
        await Promise.all([removing, adding])

        expect(gameChannel.subscribe).toHaveBeenCalledTimes(2)
        expect(gameChannel.attach).not.toHaveBeenCalled()
        expect(gameChannel.unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
            gameChannel.subscribe.mock.invocationCallOrder[1]
        )
        expect(realtime.auth.authorize).not.toHaveBeenCalled()
        expect(api.getAblyToken).toHaveBeenCalledOnce()
        expect(realtime.channels.get('user-user').subscribe).toHaveBeenCalledTimes(1)
        expect(realtime.channels.get('global').subscribe).toHaveBeenCalledTimes(1)
    })

    it('detaches a channel removed again only after its earlier removal has detached', async () => {
        const { connection, realtime, gameChannel } = await connectedWithGame('g1')
        const detached = new Gate()
        gameChannel.detach.mockReturnValueOnce(detached.promise)

        const removing = connection.removeChannel(game('g1'))
        const adding = connection.addChannel(game('g1'))
        const removingAgain = connection.removeChannel(game('g1'))
        realtime.emitConnected()
        await settled()
        expect(gameChannel.detach).toHaveBeenCalledOnce()
        expect(gameChannel.off).toHaveBeenCalledTimes(2)
        detached.open()
        await Promise.all([removing, adding, removingAgain])

        expect(gameChannel.detach).toHaveBeenCalledTimes(2)
        expect(gameChannel.subscribe).toHaveBeenCalledOnce()

        await connection.addChannel(game('g1'))
        expect(gameChannel.subscribe).toHaveBeenCalledTimes(2)
    })
})
