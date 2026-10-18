import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationChannel } from '@tabletop/frontend-components'
import { RelayConnection } from './relayConnection'
import { ChannelIdentifier, RealtimeEventType, type RealtimeEvent } from './realtimeConnection'

class FakeEventSource {
    static opened: FakeEventSource[] = []
    onmessage: ((event: MessageEvent<string>) => void) | null = null
    onerror: (() => void) | null = null
    closed = false
    private readonly listeners = new Map<string, (event: MessageEvent<string>) => void>()

    constructor(readonly url: string) {
        FakeEventSource.opened.push(this)
    }

    addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
        this.listeners.set(type, listener)
    }

    close() {
        this.closed = true
    }

    ready(topics: string[], connection?: string) {
        const data = JSON.stringify(connection ? { connection, topics } : { topics })
        this.listeners.get('ready')?.(new MessageEvent('ready', { data }))
    }

    emit(type: string) {
        this.listeners.get(type)?.(new MessageEvent(type, { data: '{}' }))
    }

    message(payload: unknown) {
        this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(payload) }))
    }

    fail() {
        this.onerror?.()
    }

    static latest(): FakeEventSource {
        const latest = FakeEventSource.opened.at(-1)
        if (!latest) throw new Error('No event source opened')
        return latest
    }
}

const timing = {
    maxJitterMs: 5_000,
    baseBackoffMs: 1_000,
    maxBackoffMs: 30_000,
    silenceLimitMs: 60_000,
    staleOnReturnMs: 35_000
}

function setup({ random = () => 0 }: { random?: () => number } = {}) {
    const getRealtimeToken = vi.fn(async (gameIds: string[]) => `token-for-${gameIds.join('+')}`)
    const post = vi.fn(async (_url: string) => new Response(null, { status: 202 }))
    const connection = new RelayConnection(
        { getRealtimeToken },
        'https://events.test',
        timing,
        random,
        post
    )
    const events: RealtimeEvent[] = []
    connection.setHandler((event) => events.push(event))
    return { connection, getRealtimeToken, post, events }
}

const user = new ChannelIdentifier(NotificationChannel.User, 'u1')
const global = new ChannelIdentifier(NotificationChannel.Global)
const game = new ChannelIdentifier(NotificationChannel.GameInstance, 'g1')

function discontinuity(channel: NotificationChannel): RealtimeEvent {
    return { type: RealtimeEventType.Discontinuity, channel }
}

function data(channel: NotificationChannel, payload: unknown): RealtimeEvent {
    return { type: RealtimeEventType.Data, channel, data: payload }
}

async function settle() {
    await vi.advanceTimersByTimeAsync(0)
}

async function connected(...channels: ChannelIdentifier[]) {
    const harness = setup()
    for (const channel of channels) await harness.connection.addChannel(channel)
    await harness.connection.connect()
    await settle()
    FakeEventSource.latest().ready(
        channels.map((channel) => channel.channelName),
        'c1'
    )
    harness.events.length = 0
    return harness
}

beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.opened = []
    vi.stubGlobal('EventSource', FakeEventSource)
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('RelayConnection', () => {
    it('opens one stream for all channels once connected', async () => {
        const { connection, getRealtimeToken } = setup()
        await connection.addChannel(user)
        await connection.addChannel(global)
        await settle()
        expect(FakeEventSource.opened).toHaveLength(0)

        await connection.connect()
        await settle()
        expect(getRealtimeToken).toHaveBeenCalledOnce()
        expect(getRealtimeToken).toHaveBeenCalledWith([])
        expect(FakeEventSource.latest().url).toBe('https://events.test/stream?t=token-for-')
    })

    it('signals one discontinuity per channel kind on the first ready', async () => {
        const { connection, events } = setup()
        await connection.addChannel(user)
        await connection.addChannel(global)
        await connection.addChannel(game)
        await connection.addChannel(new ChannelIdentifier(NotificationChannel.GameInstance, 'g2'))
        await connection.connect()
        await settle()

        FakeEventSource.latest().ready(['game-g1', 'game-g2', 'global', 'user-u1'], 'c1')
        expect(events).toEqual([
            discontinuity(NotificationChannel.User),
            discontinuity(NotificationChannel.Global),
            discontinuity(NotificationChannel.GameInstance)
        ])
    })

    it('adds a channel on the open stream and resyncs only that channel', async () => {
        const { connection, getRealtimeToken, post, events } = await connected(user, global)
        const stream = FakeEventSource.latest()

        await connection.addChannel(game)
        await settle()
        expect(getRealtimeToken).toHaveBeenLastCalledWith(['g1'])
        expect(post).toHaveBeenCalledWith('https://events.test/stream/c1/topics?t=token-for-g1')
        expect(FakeEventSource.opened).toHaveLength(1)

        stream.message({ topic: 'user-u1', message: { during: 'change' } })
        stream.ready(['game-g1', 'global', 'user-u1'])
        stream.message({ topic: 'game-g1', message: { n: 1 } })
        expect(stream.closed).toBe(false)
        expect(events).toEqual([
            data(NotificationChannel.User, { during: 'change' }),
            discontinuity(NotificationChannel.GameInstance),
            data(NotificationChannel.GameInstance, { n: 1 })
        ])
    })

    it('removes a channel on the open stream without resyncing anything', async () => {
        const { connection, getRealtimeToken, post, events } = await connected(user, global, game)
        const stream = FakeEventSource.latest()

        await connection.removeChannel(game)
        await settle()
        expect(getRealtimeToken).toHaveBeenLastCalledWith([])
        expect(post).toHaveBeenCalledOnce()
        stream.message({ topic: 'game-g1', message: { late: true } })
        stream.ready(['global', 'user-u1'])
        expect(events).toEqual([])
    })

    it('resyncs a channel the relay already carried once the client adds it', async () => {
        const { connection, events } = await connected(game)
        const stream = FakeEventSource.latest()
        stream.message({ topic: 'user-u1', message: { ignored: true } })

        await connection.addChannel(user)
        await settle()
        stream.ready(['game-g1', 'global', 'user-u1'])
        expect(events).toEqual([discontinuity(NotificationChannel.User)])
    })

    it('sends one topic change at a time, ending with the latest channels', async () => {
        const { connection, getRealtimeToken, post } = await connected(user, global)
        const stream = FakeEventSource.latest()

        await connection.addChannel(game)
        await settle()
        await connection.addChannel(new ChannelIdentifier(NotificationChannel.GameInstance, 'g2'))
        await settle()
        expect(post).toHaveBeenCalledOnce()

        stream.ready(['game-g1', 'global', 'user-u1'])
        await settle()
        expect(post).toHaveBeenCalledTimes(2)
        expect(getRealtimeToken).toHaveBeenLastCalledWith(['g1', 'g2'])

        stream.ready(['game-g1', 'game-g2', 'global', 'user-u1'])
        await settle()
        expect(post).toHaveBeenCalledTimes(2)
    })

    it('waits for the first ready before changing topics', async () => {
        const { connection, post } = setup()
        await connection.addChannel(user)
        await connection.connect()
        await settle()
        await connection.addChannel(game)
        await settle()
        expect(post).not.toHaveBeenCalled()

        FakeEventSource.latest().ready(['global', 'user-u1'], 'c1')
        await settle()
        expect(post).toHaveBeenCalledWith('https://events.test/stream/c1/topics?t=token-for-g1')
    })

    it('reconnects and resyncs everything when a topic change is refused', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const { connection, post, events } = await connected(user, global)
        const stream = FakeEventSource.latest()
        post.mockResolvedValueOnce(new Response(null, { status: 404 }))

        await connection.addChannel(game)
        await settle()
        expect(stream.closed).toBe(true)
        await settle()
        FakeEventSource.latest().ready(['game-g1', 'global', 'user-u1'], 'c2')
        expect(FakeEventSource.opened).toHaveLength(2)
        expect(events).toEqual([
            discontinuity(NotificationChannel.User),
            discontinuity(NotificationChannel.Global),
            discontinuity(NotificationChannel.GameInstance)
        ])
    })

    it('reconnects and resyncs everything after the stream fails', async () => {
        const { events } = await connected(user, global)
        FakeEventSource.latest().fail()
        await settle()
        FakeEventSource.latest().ready(['global', 'user-u1'], 'c2')
        expect(FakeEventSource.opened).toHaveLength(2)
        expect(events).toEqual([
            discontinuity(NotificationChannel.User),
            discontinuity(NotificationChannel.Global)
        ])
    })

    it('delivers messages on the channel their topic names', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { events } = await connected(user, global)
        const stream = FakeEventSource.latest()

        stream.message({ topic: 'global', message: { n: 1 } })
        stream.message({ topic: 'user-u1', message: { n: 2 } })
        stream.message({ topic: 'game-other', message: { n: 3 } })
        stream.message({ unexpected: true })
        expect(events).toEqual([
            data(NotificationChannel.Global, { n: 1 }),
            data(NotificationChannel.User, { n: 2 })
        ])
        expect(consoleError).toHaveBeenCalledOnce()
    })

    it('reconnects after a random delay, then backs off until a stream is ready', async () => {
        const delays = [0.5, 0.5, 0.5, 0.5]
        const { connection, getRealtimeToken } = setup({ random: () => delays.shift() ?? 0 })
        await connection.addChannel(user)
        await connection.connect()
        await settle()

        FakeEventSource.latest().fail()
        await vi.advanceTimersByTimeAsync(2_499)
        expect(getRealtimeToken).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(1)
        expect(getRealtimeToken).toHaveBeenCalledTimes(2)

        FakeEventSource.latest().fail()
        await vi.advanceTimersByTimeAsync(3_499)
        expect(getRealtimeToken).toHaveBeenCalledTimes(2)
        await vi.advanceTimersByTimeAsync(1)
        expect(getRealtimeToken).toHaveBeenCalledTimes(3)

        FakeEventSource.latest().ready(['user-u1'], 'c3')
        FakeEventSource.latest().fail()
        await vi.advanceTimersByTimeAsync(2_500)
        expect(getRealtimeToken).toHaveBeenCalledTimes(4)
    })

    it('retries when the token request fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const { connection, getRealtimeToken } = setup({ random: () => 0.5 })
        getRealtimeToken.mockRejectedValueOnce(new Error('offline'))
        await connection.addChannel(user)
        await connection.connect()
        await settle()
        expect(FakeEventSource.opened).toHaveLength(0)

        await vi.advanceTimersByTimeAsync(2_500)
        expect(getRealtimeToken).toHaveBeenCalledTimes(2)
        expect(FakeEventSource.opened).toHaveLength(1)
    })

    it('ignores connect while its stream is open', async () => {
        const { connection, getRealtimeToken } = await connected(user, global)

        await connection.connect()
        await settle()
        expect(getRealtimeToken).toHaveBeenCalledOnce()
        expect(FakeEventSource.opened).toHaveLength(1)
    })

    it('reconnects at once when the tab is shown while a retry is waiting', async () => {
        const { connection, getRealtimeToken } = setup({ random: () => 1 })
        await connection.addChannel(user)
        await connection.connect()
        await settle()
        connection.tabVisibilityChanged(false)
        FakeEventSource.latest().fail()
        await settle()
        expect(getRealtimeToken).toHaveBeenCalledOnce()

        connection.tabVisibilityChanged(true)
        await settle()
        expect(getRealtimeToken).toHaveBeenCalledTimes(2)
        expect(FakeEventSource.opened).toHaveLength(2)

        await vi.advanceTimersByTimeAsync(5_000)
        expect(getRealtimeToken).toHaveBeenCalledTimes(2)
    })

    it('treats a stream that has gone quiet as dead', async () => {
        const { getRealtimeToken } = await connected(user, global)
        const stream = FakeEventSource.latest()

        await vi.advanceTimersByTimeAsync(50_000)
        stream.emit('keepalive')
        await vi.advanceTimersByTimeAsync(50_000)
        expect(stream.closed).toBe(false)

        await vi.advanceTimersByTimeAsync(10_000)
        expect(stream.closed).toBe(true)
        await vi.advanceTimersByTimeAsync(timing.maxJitterMs)
        expect(getRealtimeToken).toHaveBeenCalledTimes(2)
    })

    it('reopens and resyncs a stream that went quiet while the tab was hidden', async () => {
        const { connection, events } = await connected(user, global)
        const stream = FakeEventSource.latest()
        connection.tabVisibilityChanged(false)

        await vi.advanceTimersByTimeAsync(40_000)
        connection.tabVisibilityChanged(true)
        await settle()
        expect(stream.closed).toBe(true)
        expect(FakeEventSource.opened).toHaveLength(2)

        FakeEventSource.latest().ready(['global', 'user-u1'], 'c2')
        expect(events).toEqual([
            discontinuity(NotificationChannel.User),
            discontinuity(NotificationChannel.Global)
        ])
    })

    it('keeps a stream that is still heard from when the tab is shown', async () => {
        const { connection } = await connected(user, global)
        const stream = FakeEventSource.latest()
        connection.tabVisibilityChanged(false)

        await vi.advanceTimersByTimeAsync(25_000)
        stream.emit('keepalive')
        await vi.advanceTimersByTimeAsync(20_000)
        connection.tabVisibilityChanged(true)
        await settle()
        expect(stream.closed).toBe(false)
        expect(FakeEventSource.opened).toHaveLength(1)
    })

    it('waits to be shown before reconnecting after being evicted while hidden', async () => {
        const { connection, getRealtimeToken } = await connected(user, global)
        connection.tabVisibilityChanged(false)
        FakeEventSource.latest().emit('evicted')
        expect(FakeEventSource.latest().closed).toBe(true)

        await connection.addChannel(game)
        await vi.advanceTimersByTimeAsync(120_000)
        expect(getRealtimeToken).toHaveBeenCalledOnce()

        connection.tabVisibilityChanged(true)
        await settle()
        expect(getRealtimeToken).toHaveBeenCalledTimes(2)
        expect(FakeEventSource.opened).toHaveLength(2)
    })

    it('reconnects as usual after being evicted while visible', async () => {
        const { connection, getRealtimeToken } = await connected(user, global)
        connection.tabVisibilityChanged(true)
        FakeEventSource.latest().emit('evicted')

        await vi.advanceTimersByTimeAsync(5_000)
        expect(getRealtimeToken).toHaveBeenCalledTimes(2)
        expect(FakeEventSource.opened).toHaveLength(2)
    })

    it('stops everything on disconnect', async () => {
        const { connection, getRealtimeToken } = setup({ random: () => 1 })
        await connection.addChannel(user)
        await connection.connect()
        await settle()
        const stream = FakeEventSource.latest()
        stream.fail()

        connection.disconnect()
        await vi.advanceTimersByTimeAsync(60_000)
        expect(stream.closed).toBe(true)
        expect(getRealtimeToken).toHaveBeenCalledOnce()
    })
})
