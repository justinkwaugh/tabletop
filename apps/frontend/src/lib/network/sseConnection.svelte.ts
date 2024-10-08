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

export class SseConnection implements RealtimeConnection {
    static MAX_RETRY_TIMEOUT = 10000

    public connectionStatus = ConnectionStatus.Disconnected

    private api: TabletopApi
    private handler?: RealtimeEventHandler
    private path?: string
    private isGame = false

    private eventSource: EventSource | null = null
    private retryTimer: ReturnType<typeof setTimeout> | null = null

    constructor({ api }: { api: TabletopApi }) {
        this.api = api
    }

    setHandler(handler: RealtimeEventHandler) {
        this.handler = handler
    }

    async addChannel(identifier: ChannelIdentifier): Promise<void> {
        const oldPath = this.path
        const newPath =
            identifier.channel === NotificationChannel.GameInstance
                ? `${GAME_PATH}/${identifier.id}`
                : USER_PATH

        if (identifier.channel === NotificationChannel.GameInstance) {
            this.isGame = true
        }

        if (newPath !== oldPath) {
            this.path = newPath
            if (this.connectionStatus === ConnectionStatus.Connected) {
                console.log('Switching realtime connection to', this.path)
                this.disconnect()
                await this.connect()
            }
        }
    }

    async removeChannel(identifier: ChannelIdentifier): Promise<void> {
        if (identifier.channel === NotificationChannel.GameInstance) {
            this.isGame = false
            this.path = USER_PATH
            if (this.connectionStatus === ConnectionStatus.Connected) {
                console.log('Switching realtime connection to', this.path)
                this.disconnect()
                await this.connect()
            }
        }
    }

    async connect() {
        if (this.connectionStatus !== ConnectionStatus.Disconnected) {
            return
        }

        try {
            console.log(`Connecting event source on ${this.path}`)
            const token = await this.api.getSseToken()
            this.connectionStatus = ConnectionStatus.Connecting
            this.eventSource = this.api.getEventSource(`${this.path}/${token}`)

            this.eventSource.onopen = () => {
                console.log('Event source connected')
                this.connectionStatus = ConnectionStatus.Connected

                if (this.isGame) {
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

            this.eventSource.onerror = () => {
                console.log('Error on event source')
                this.disconnect()
                this.scheduleRetry()
            }

            this.eventSource.onmessage = (event) => {
                if (event.data === 'hello') {
                    return
                }
                console.log('Received event', event)
                const parsedData = JSON.parse(event.data)

                const realtimeEvent: RealtimeEvent = {
                    type: RealtimeEventType.Data,
                    channel: this.isGame
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
            this.scheduleRetry()
        }
    }

    disconnect() {
        this.cancelRetry()

        if (!this.eventSource) {
            return
        }

        this.eventSource.close()
        this.eventSource = null

        this.connectionStatus = ConnectionStatus.Disconnected
        console.log('Realtime feed closed, status', this.connectionStatus)
    }

    private scheduleRetry() {
        console.log('Scheduling retry')
        this.cancelRetry()
        const timeout = 3000
        this.retryTimer = setTimeout(async () => {
            console.log('Retrying connection')
            await this.connect()
            this.retryTimer = null
        }, timeout)
    }

    private cancelRetry() {
        if (this.retryTimer) {
            console.log('Cancelling retry')
            clearTimeout(this.retryTimer)

            this.retryTimer = null
        }
    }
}
