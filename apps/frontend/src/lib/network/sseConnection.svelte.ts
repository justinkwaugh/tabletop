import { TabletopApi } from '@tabletop/frontend-components'

export enum ConnectionStatus {
    Disconnected = 'disconnected',
    Connecting = 'connecting',
    Connected = 'connected'
}

export type SseEventHandler = (event: MessageEvent) => void
export type ConnectionCallback = () => void

export class SseConnection {
    static MAX_RETRY_TIMEOUT = 10000

    public connectionStatus = ConnectionStatus.Disconnected

    private path: string
    private api: TabletopApi
    private handler: SseEventHandler
    private connectionCallback: ConnectionCallback | undefined

    private eventSource: EventSource | null = null
    private retryTimer: ReturnType<typeof setTimeout> | null = null

    constructor({
        api,
        path,
        handler,
        onConnect
    }: {
        api: TabletopApi
        path: string
        handler: SseEventHandler
        onConnect?: ConnectionCallback
    }) {
        this.api = api
        this.path = path
        this.handler = handler
        this.connectionCallback = onConnect
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
                if (this.connectionCallback) {
                    this.connectionCallback()
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
                this.handler(event)
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
