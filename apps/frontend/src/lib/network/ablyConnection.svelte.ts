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
    subscribed: boolean
}

export class AblyConnection implements RealtimeTransport {
    private handler?: RealtimeEventHandler

    private channels: Map<string, ChannelData> = new Map()

    private removals: Map<string, Promise<void>> = new Map()

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
        for (const channelData of [...this.channels.values()]) {
            try {
                await this.syncHeldChannel(channelData)
            } catch (error) {
                // Closing the connection rejects pending attaches; the next 'connected' resubscribes.
                if (this.isClosed()) {
                    return
                }
                if (!this.holds(channelData)) {
                    continue
                }
                console.error(
                    `Failed to resubscribe realtime channel ${channelData.ablyChannel.name}`,
                    error
                )
            }
        }
    }

    private holds(channelData: ChannelData): boolean {
        return this.channels.get(channelData.identifier.channelName) === channelData
    }

    private async syncHeldChannel(channelData: ChannelData) {
        await this.removals.get(channelData.identifier.channelName)
        if (!this.holds(channelData) || this.ably.connection.state !== 'connected') {
            return
        }
        if (!channelData.subscribed) {
            channelData.subscribed = true
            await this.subscribeToChannel(channelData)
            return
        }
        const channel = channelData.ablyChannel
        if (channel.state !== 'attached' && channel.state !== 'attaching') {
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
        const channelName = identifier.channelName
        if (this.channels.has(channelName)) {
            return
        }

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

        const channelData: ChannelData = { identifier, ablyChannel, subscribed: false }
        this.channels.set(channelName, channelData)

        await this.ensureGrants()
        await this.syncHeldChannel(channelData)
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

    async removeChannel(identifier: ChannelIdentifier) {
        const channelName = identifier.channelName
        const channelData = this.channels.get(channelName)
        if (!channelData) {
            return
        }

        this.channels.delete(channelName)
        const earlierRemoval = this.removals.get(channelName)
        const removal = this.detachChannel(channelData, earlierRemoval).finally(() => {
            if (this.removals.get(channelName) === removal) {
                this.removals.delete(channelName)
            }
        })
        this.removals.set(channelName, removal)
        await removal
    }

    private async detachChannel(channelData: ChannelData, earlierRemoval?: Promise<void>) {
        channelData.ablyChannel.off()
        channelData.ablyChannel.unsubscribe()
        await earlierRemoval
        try {
            await channelData.ablyChannel.detach()
        } catch {
            // ignore detach errors
        }
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
