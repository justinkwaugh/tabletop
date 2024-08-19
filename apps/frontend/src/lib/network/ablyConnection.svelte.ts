import Ably from 'ably'
import {
    type RealtimeConnection,
    type RealtimeEvent,
    RealtimeEventType,
    type RealtimeEventHandler,
    ChannelIdentifier
} from './realtimeConnection'
import type { NotificationChannel, TabletopApi } from '@tabletop/frontend-components'

type ChannelData = {
    channel: NotificationChannel
    ablyChannel: Ably.RealtimeChannel
}

export class AblyConnection implements RealtimeConnection {
    private handler?: RealtimeEventHandler

    private channels: Map<string, ChannelData> = new Map()

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
                const channel = channelData.ablyChannel
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

    async addChannel(identifier: ChannelIdentifier) {
        if (this.channels.get(identifier.channelName)) {
            return
        }

        const channelName = identifier.channelName
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
                channel: identifier.channel
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

        const channelData: ChannelData = { channel: identifier.channel, ablyChannel: ablyChannel }
        this.channels.set(channelName, channelData)

        if (this.ably.connection.state === 'connected') {
            console.log('Adding channel to connected connection')
            await this.subscribeToChannel(channelData)
        }
        console.log('Now channels', this.channels)
    }

    private async subscribeToChannel(channelData: ChannelData) {
        console.log('Subscribing to channel', channelData.channel)
        await channelData.ablyChannel.subscribe((message) => {
            try {
                const data = JSON.parse(message.data)
                const realtimeEvent: RealtimeEvent = {
                    type: RealtimeEventType.Data,
                    channel: channelData.channel,
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

    async removeChannel(channel: ChannelIdentifier) {
        const channelData = this.channels.get(channel.channelName)

        if (!channelData) {
            return
        }

        console.log('Removing channel', channel.channelName)
        channelData.ablyChannel.unsubscribe()
        try {
            await channelData.ablyChannel.detach()
        } catch (e) {
            console.error('Error detaching channel', channelData.channel, e)
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
