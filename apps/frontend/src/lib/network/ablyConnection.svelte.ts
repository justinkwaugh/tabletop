import Ably from 'ably'
import {
    type RealtimeTransport,
    type RealtimeEvent,
    RealtimeEventType,
    type RealtimeEventHandler,
    ChannelIdentifier
} from './realtimeConnection'
import { NotificationChannel, type TabletopApi } from '@tabletop/frontend-components'

type ChannelData = {
    identifier: ChannelIdentifier
    ablyChannel: Ably.RealtimeChannel
}

export class AblyConnection implements RealtimeTransport {
    private handler?: RealtimeEventHandler

    private channels: Map<string, ChannelData> = new Map()

    private grantedGameIds: Set<string> = new Set()

    private ably: Ably.Realtime

    constructor(private readonly api: Pick<TabletopApi, 'getAblyToken'>) {
        this.ably = new Ably.Realtime({
            autoConnect: false,
            authCallback: async (_tokenParams, callback) => {
                const gameIds = this.gameIds()
                let tokenRequest
                try {
                    tokenRequest = await this.api.getAblyToken(gameIds)
                } catch (err) {
                    callback(JSON.stringify(err), null)
                    return
                }
                this.grantedGameIds = new Set(gameIds)
                callback(null, tokenRequest)
            }
        })
        this.ably.connection.on('connected', () => {
            console.log('Realtime feed connected')
            void this.resubscribeChannels()
        })
    }

    private gameIds(): string[] {
        return [...this.channels.values()]
            .map(({ identifier }) => identifier)
            .filter((identifier) => identifier.channel === NotificationChannel.GameInstance)
            .map((identifier) => identifier.id)
            .filter((id): id is string => id !== undefined)
    }

    private async ensureGrants() {
        if (this.ably.connection.state !== 'connected') {
            return
        }
        if (this.gameIds().every((gameId) => this.grantedGameIds.has(gameId))) {
            return
        }
        await this.ably.auth.authorize()
    }

    private async resubscribeChannels() {
        try {
            await this.ensureGrants()
        } catch (error) {
            if (this.isClosed()) {
                return
            }
            console.error('Failed to renew realtime grants', error)
            return
        }
        for (const channelData of this.channels.values()) {
            try {
                await this.resubscribeChannel(channelData)
            } catch (error) {
                // Closing the connection rejects pending attaches; the next 'connected' resubscribes.
                if (this.isClosed()) {
                    return
                }
                console.error(
                    `Failed to resubscribe realtime channel ${channelData.ablyChannel.name}`,
                    error
                )
            }
        }
    }

    private async resubscribeChannel(channelData: ChannelData) {
        const channel = channelData.ablyChannel
        if (channel.state === 'initialized') {
            await this.subscribeToChannel(channelData)
        } else if (channel.state !== 'attached' && channel.state !== 'attaching') {
            await channel.attach()
        }
    }

    private isClosed() {
        const state = this.ably.connection.state
        return state === 'closing' || state === 'closed'
    }

    setHandler(handler: RealtimeEventHandler) {
        this.handler = handler
    }

    async addChannel(identifier: ChannelIdentifier) {
        if (this.channels.get(identifier.channelName)) {
            return
        }

        const channelName = identifier.channelName
        const ablyChannel = this.ably.channels.get(channelName)
        ablyChannel.on('attached', () => {
            const realtimeEvent: RealtimeEvent = {
                type: RealtimeEventType.Discontinuity,
                channel: identifier.channel
            }
            if (this.handler) {
                this.handler(realtimeEvent)
            }
        })

        const channelData: ChannelData = { identifier, ablyChannel }
        this.channels.set(channelName, channelData)

        if (this.ably.connection.state === 'connected') {
            await this.ensureGrants()
            await this.subscribeToChannel(channelData)
        }
    }

    private async subscribeToChannel(channelData: ChannelData) {
        await channelData.ablyChannel.subscribe((message) => {
            try {
                const data = JSON.parse(message.data)
                const realtimeEvent: RealtimeEvent = {
                    type: RealtimeEventType.Data,
                    channel: channelData.identifier.channel,
                    data: data
                }
                if (this.handler) {
                    this.handler(realtimeEvent)
                }
            } catch {
                console.error('Error handling realtime message', message)
                return
            }
        })
    }

    async removeChannel(channel: ChannelIdentifier) {
        const channelData = this.channels.get(channel.channelName)

        if (!channelData) {
            return
        }

        channelData.ablyChannel.off()
        channelData.ablyChannel.unsubscribe()
        try {
            await channelData.ablyChannel.detach()
        } catch {
            // ignore detach errors
        }

        this.channels.delete(channel.channelName)
    }

    async connect() {
        console.log('Trying to connect realtime feed')
        this.ably.connect()
    }

    disconnect() {
        if (this.ably.connection.state === 'closed') {
            return
        }
        this.ably.close()
        console.log('Realtime feed closed')
    }
}
