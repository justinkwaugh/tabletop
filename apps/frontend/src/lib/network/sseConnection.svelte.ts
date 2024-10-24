import { NotificationChannel, TabletopApi } from '@tabletop/frontend-components'
import {
    RealtimeEventType,
    type ChannelIdentifier,
    type RealtimeConnection,
    type RealtimeEvent,
    type RealtimeEventHandler
} from './realtimeConnection'

export enum ConnectionStatus {
    Disconnected = 'disconnected',
    Connecting = 'connecting',
    Connected = 'connected'
}

const GAME_PATH = '/sse/game'
const USER_PATH = '/sse/user'

type ChannelData = {
    channel: NotificationChannel
    path: string
    eventSource?: EventSource
    retryTimer?: ReturnType<typeof setTimeout>
    connectionStatus: ConnectionStatus
}

export class SseConnection implements RealtimeConnection {
    static MAX_RETRY_TIMEOUT = 10000

    public connectionStatus = ConnectionStatus.Disconnected

    private api: TabletopApi
    private handler?: RealtimeEventHandler
    private channels: Map<string, ChannelData> = new Map()

    constructor({ api }: { api: TabletopApi }) {
        this.api = api
    }

    setHandler(handler: RealtimeEventHandler) {
        this.handler = handler
    }

    async addChannel(identifier: ChannelIdentifier): Promise<void> {
        console.log('Adding channel', identifier)

        if (this.channels.has(identifier.channelName)) {
            return
        }

        const channelData: ChannelData = {
            channel: identifier.channel,
            path:
                identifier.channel === NotificationChannel.GameInstance
                    ? `${GAME_PATH}/${identifier.id}`
                    : USER_PATH,
            connectionStatus: ConnectionStatus.Disconnected
        }

        this.channels.set(identifier.channelName, channelData)

        if (this.connectionStatus === ConnectionStatus.Connected) {
            await this.connectChannel(channelData)
        }
    }

    async removeChannel(identifier: ChannelIdentifier): Promise<void> {
        console.log('Removing channel', identifier)
        const channelData = this.channels.get(identifier.channelName)
        if (channelData) {
            this.disconnectChannel(channelData)
        }
        this.channels.delete(identifier.channelName)
    }

    async connect() {
        if (this.connectionStatus !== ConnectionStatus.Disconnected) {
            return
        }
        this.connectionStatus = ConnectionStatus.Connected
        for (const [, channelData] of this.channels) {
            await this.connectChannel(channelData)
        }
    }

    disconnect() {
        if (this.connectionStatus === ConnectionStatus.Disconnected) {
            return
        }
        for (const [, channelData] of this.channels) {
            this.disconnectChannel(channelData)
        }
        this.connectionStatus = ConnectionStatus.Connected
    }

    disconnectChannel(channelData: ChannelData) {
        this.cancelRetry(channelData)

        if (!channelData.eventSource) {
            return
        }

        channelData.eventSource.close()
        channelData.eventSource = undefined

        channelData.connectionStatus = ConnectionStatus.Disconnected
        console.log(
            'Realtime feed closed for channel',
            channelData.channel,
            channelData.connectionStatus
        )
    }

    private async connectChannel(channelData: ChannelData) {
        try {
            console.log(`Connecting event source on ${channelData.path}`)
            const token = await this.api.getSseToken()
            channelData.connectionStatus = ConnectionStatus.Connecting
            channelData.eventSource = this.api.getEventSource(`${channelData.path}/${token}`)
            channelData.eventSource.onopen = () => {
                console.log('Event source connected')
                channelData.connectionStatus = ConnectionStatus.Connected

                if (channelData.channel === NotificationChannel.GameInstance) {
                    const realtimeEvent: RealtimeEvent = {
                        type: RealtimeEventType.Discontinuity,
                        channel: NotificationChannel.GameInstance
                    }
                    if (this.handler) {
                        this.handler(realtimeEvent)
                    }
                } else {
                    const realtimeEvent: RealtimeEvent = {
                        type: RealtimeEventType.Discontinuity,
                        channel: NotificationChannel.User
                    }

                    if (this.handler) {
                        this.handler(realtimeEvent)
                    }
                }
            }

            channelData.eventSource.onerror = () => {
                console.log('Error on event source')
                this.disconnect()
                this.scheduleRetry(channelData)
            }

            channelData.eventSource.onmessage = (event) => {
                if (event.data === 'hello') {
                    return
                }
                console.log('Received event', event)
                const parsedData = JSON.parse(event.data)

                const realtimeEvent: RealtimeEvent = {
                    type: RealtimeEventType.Data,
                    channel:
                        channelData.channel === NotificationChannel.GameInstance
                            ? NotificationChannel.GameInstance
                            : NotificationChannel.User,
                    data: parsedData
                }
                if (this.handler) {
                    this.handler(realtimeEvent)
                }
            }
        } catch (e) {
            console.error('Error connecting to event source', e)
            this.scheduleRetry(channelData)
        }
    }

    private scheduleRetry(channelData: ChannelData) {
        console.log('Scheduling retry for channel', channelData.channel)
        this.cancelRetry(channelData)
        const timeout = 5000
        channelData.retryTimer = setTimeout(async () => {
            console.log('Retrying connection for channel', channelData.channel)
            channelData.retryTimer = undefined
            await this.connectChannel(channelData)
        }, timeout)
    }

    private cancelRetry(channelData: ChannelData) {
        if (channelData.retryTimer) {
            console.log('Cancelling retry for channel', channelData.channel)
            clearTimeout(channelData.retryTimer)
            channelData.retryTimer = undefined
        }
    }
}
