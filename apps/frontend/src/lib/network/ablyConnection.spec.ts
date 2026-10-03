import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationChannel, TabletopApi } from '@tabletop/frontend-components'
import { AblyConnection } from './ablyConnection.svelte'
import { ChannelIdentifier } from './realtimeConnection'

const ably = vi.hoisted(() => {
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
        constructor() {
            FakeRealtime.latest = this
        }
        connected() {
            this.connection.state = 'connected'
            for (const listener of this.connectedListeners) void listener()
        }
    }
    return { FakeRealtime }
})

vi.mock('ably', () => ({ default: { Realtime: ably.FakeRealtime } }))

afterEach(() => {
    vi.restoreAllMocks()
})

async function connectionWithTwoChannels() {
    const connection = new AblyConnection(new TabletopApi())
    await connection.addChannel(new ChannelIdentifier(NotificationChannel.User, 'user'))
    await connection.addChannel(new ChannelIdentifier(NotificationChannel.Global))
    const realtime = ably.FakeRealtime.latest
    const user = realtime.channels.get('user-user')
    const global = realtime.channels.get('global')
    return { realtime, user, global }
}

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

        realtime.connected()
        await new Promise((resolve) => setTimeout(resolve, 0))
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

        realtime.connected()
        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(consoleError).toHaveBeenCalledWith(
            'Failed to resubscribe realtime channel user-user',
            failure
        )
        expect(global.subscribe).toHaveBeenCalledOnce()
    })
})
