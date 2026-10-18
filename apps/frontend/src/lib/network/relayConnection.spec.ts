import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationChannel } from '@tabletop/frontend-components'
import { RelayConnection } from './relayConnection'
import { ChannelIdentifier, RealtimeEventType, type RealtimeEvent } from './realtimeConnection'

class FakeEventSource {
    static opened: FakeEventSource[] = []
    onmessage: ((event: MessageEvent<string>) => void) | null = null
    onerror: (() => void) | null = null
    closed = false
    private readonly listeners = new Map<string, () => void>()

    constructor(readonly url: string) {
        FakeEventSource.opened.push(this)
    }

    addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, listener)
    }

    close() {
        this.closed = true
    }

    ready() {
        this.listeners.get('ready')?.()
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

const timing = { maxJitterMs: 5_000, baseBackoffMs: 1_000, maxBackoffMs: 30_000 }

function setup({ random = () => 0 }: { random?: () => number } = {}) {
    const getRealtimeToken = vi.fn(async (gameIds: string[]) => `token-for-${gameIds.join('+')}`)
    const connection = new RelayConnection(
        { getRealtimeToken },
        'https://events.test',
        timing,
        random
    )
    const events: RealtimeEvent[] = []
    connection.setHandler((event) => events.push(event))
    return { connection, getRealtimeToken, events }
}

const user = new ChannelIdentifier(NotificationChannel.User, 'u1')
const global = new ChannelIdentifier(NotificationChannel.Global)
const game = new ChannelIdentifier(NotificationChannel.GameInstance, 'g1')

function discontinuity(channel: NotificationChannel): RealtimeEvent {
    return { type: RealtimeEventType.Discontinuity, channel }
}

async function settle() {
    await vi.advanceTimersByTimeAsync(0)
}

async function connected(...channels: ChannelIdentifier[]) {
    const harness = setup()
    for (const channel of channels) await harness.connection.addChannel(channel)
    await harness.connection.connect()
    await settle()
    FakeEventSource.latest().ready()
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

    it('signals one discontinuity per channel kind when the first stream is ready', async () => {
        const { connection, events } = setup()
        await connection.addChannel(user)
        await connection.addChannel(global)
        await connection.addChannel(game)
        await connection.addChannel(new ChannelIdentifier(NotificationChannel.GameInstance, 'g2'))
        await connection.connect()
        await settle()

        FakeEventSource.latest().ready()
        expect(events).toEqual([
            discontinuity(NotificationChannel.User),
            discontinuity(NotificationChannel.Global),
            discontinuity(NotificationChannel.GameInstance)
        ])
    })

    it('keeps the live stream until its replacement is ready', async () => {
        const { connection, getRealtimeToken, events } = await connected(user, global)
        const live = FakeEventSource.latest()

        await connection.addChannel(game)
        await settle()
        const replacement = FakeEventSource.latest()
        expect(getRealtimeToken).toHaveBeenLastCalledWith(['g1'])
        expect(replacement.url).toBe('https://events.test/stream?t=token-for-g1')
        expect(live.closed).toBe(false)

        live.message({ topic: 'user-u1', message: { during: 'switch' } })
        replacement.ready()
        expect(live.closed).toBe(true)
        expect(events).toEqual([
            {
                type: RealtimeEventType.Data,
                channel: NotificationChannel.User,
                data: { during: 'switch' }
            },
            discontinuity(NotificationChannel.GameInstance)
        ])
    })

    it('signals nothing when a channel is removed', async () => {
        const { connection, getRealtimeToken, events } = await connected(user, global, game)

        await connection.removeChannel(game)
        await settle()
        expect(getRealtimeToken).toHaveBeenLastCalledWith([])
        FakeEventSource.latest().ready()
        expect(events).toEqual([])
    })

    it('signals every channel after the live stream fails', async () => {
        const { events } = await connected(user, global)
        FakeEventSource.latest().fail()
        await settle()
        FakeEventSource.latest().ready()
        expect(FakeEventSource.opened).toHaveLength(2)
        expect(events).toEqual([
            discontinuity(NotificationChannel.User),
            discontinuity(NotificationChannel.Global)
        ])
    })

    it('signals every channel when the live stream fails while a replacement opens', async () => {
        const { connection, events } = await connected(user, global)
        const live = FakeEventSource.latest()
        await connection.addChannel(game)
        await settle()
        live.fail()
        FakeEventSource.latest().ready()
        expect(events).toEqual([
            discontinuity(NotificationChannel.User),
            discontinuity(NotificationChannel.Global),
            discontinuity(NotificationChannel.GameInstance)
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
            { type: RealtimeEventType.Data, channel: NotificationChannel.Global, data: { n: 1 } },
            { type: RealtimeEventType.Data, channel: NotificationChannel.User, data: { n: 2 } }
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

        FakeEventSource.latest().ready()
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

    it('ignores a token that arrives after the channels changed again', async () => {
        const { connection, getRealtimeToken } = setup()
        let releaseFirst: (token: string) => void = () => {}
        getRealtimeToken.mockImplementationOnce(
            () => new Promise<string>((resolve) => (releaseFirst = resolve))
        )
        await connection.addChannel(user)
        await connection.connect()
        await settle()
        await connection.addChannel(game)
        await settle()
        releaseFirst('stale')
        await settle()
        expect(FakeEventSource.opened.map((stream) => stream.url)).toEqual([
            'https://events.test/stream?t=token-for-g1'
        ])
    })
})
