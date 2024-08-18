import Ably from 'ably'
import type { NotificationCategory } from '@tabletop/common'
import {
    type RealtimeConnection,
    type RealtimeEvent,
    RealtimeEventType,
    type RealtimeEventHandler,
    Channel
} from './realtimeConnection'
import type { TabletopApi } from '@tabletop/frontend-components'

export class AblyConnection implements RealtimeConnection {
    private handler?: RealtimeEventHandler

    private channels: Map<
        string,
        { category: NotificationCategory; channel: Ably.RealtimeChannel }
    > = new Map()

    private ably: Ably.Realtime

    constructor(private readonly api: TabletopApi) {
        this.ably = new Ably.Realtime({
            autoConnect: false,
            authCallback: async (tokenParams, callback) => {
                let tokenRequest
                try {
                    tokenRequest = await api.getAblyToken() // Make a network request to your server
                } catch (err) {
                    callback(JSON.stringify(err), null)
                    return
                }
                callback(null, tokenRequest)
            }
        })
        this.ably.connection.on('connected', async () => {
            // Subscribe or attach to all channels on connect
            for (const channelData of this.channels.values()) {
                const channel = channelData.channel
                console.log('Checking Channel state', channel.state, channel.name)
                if (channel.state === 'initialized') {
                    await this.subscribeToChannel(channelData)
                } else if (channel.state !== 'attached' && channel.state !== 'attaching') {
                    await channel.attach()
                }
            }
            console.log('Realtime feed connected')
        })
    }

    setHandler(handler: RealtimeEventHandler) {
        this.handler = handler
    }

    async addChannel(channel: Channel) {
        if (this.channels.get(channel.channelName)) {
            return
        }

        const channelName = channel.channelName
        console.log('Adding channel', channelName)
        const ablyChannel = this.ably.channels.get(channelName)
        // ablyChannel.on('initialized', (event) => {
        //     console.log('Channel', channelName, 'initialize', event)
        // })
        // ablyChannel.on('attaching', (event) => {
        //     console.log('Channel', channelName, 'attaching', event)
        // })
        ablyChannel.on('attached', (event) => {
            const realtimeEvent: RealtimeEvent = {
                type: RealtimeEventType.Discontinuity,
                category: channel.category
            }
            if (this.handler) {
                this.handler(realtimeEvent)
            }
            console.log('Channel', channelName, 'attached', event)
        })
        // ablyChannel.on('detaching', (event) => {
        //     console.log('Channel', channelName, 'detaching', event)
        // })
        // ablyChannel.on('detached', (event) => {
        //     console.log('Channel', channelName, 'detached', event)
        // })
        // ablyChannel.on('failed', (err) => {
        //     console.log('Channel', channelName, 'failed', err)
        // })
        // ablyChannel.on('suspended', (event) => {
        //     console.log('Channel', channelName, 'suspended', event)
        // })
        // ablyChannel.on('update', (event) => {
        //     console.log('Channel', channelName, 'update', event)
        // })

        const channelData = { category: channel.category, channel: ablyChannel }
        this.channels.set(channelName, channelData)

        if (this.ably.connection.state === 'connected') {
            console.log('Adding channel to connected connection')
            await this.subscribeToChannel(channelData)
        }
        console.log('Now channels', this.channels)
    }

    private async subscribeToChannel({
        category,
        channel
    }: {
        category: NotificationCategory
        channel: Ably.RealtimeChannel
    }) {
        console.log('Subscribing to channel', channel.name)
        await channel.subscribe((message) => {
            try {
                const data = JSON.parse(message.data)
                const realtimeEvent: RealtimeEvent = {
                    type: RealtimeEventType.Data,
                    category,
                    data: data
                }
                if (this.handler) {
                    this.handler(realtimeEvent)
                }
            } catch (e) {
                console.error('Error handling realtime message', message)
                return
            }
        })
    }

    async removeChannel(channel: Channel) {
        const channelData = this.channels.get(channel.channelName)

        if (!channelData) {
            return
        }

        console.log('Removing channel', channel.channelName)
        channelData.channel.unsubscribe()
        await channelData.channel.detach()

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
