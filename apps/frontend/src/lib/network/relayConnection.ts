import { NotificationChannel, type TabletopApi } from '@tabletop/frontend-components'
import {
    ChannelIdentifier,
    RealtimeEventType,
    type RealtimeConnection,
    type RealtimeEventHandler
} from './realtimeConnection'

export type RelayReconnectTiming = {
    maxJitterMs: number
    baseBackoffMs: number
    maxBackoffMs: number
    silenceLimitMs: number
    staleOnReturnMs: number
}

const DEFAULT_RECONNECT_TIMING: RelayReconnectTiming = {
    maxJitterMs: 5_000,
    baseBackoffMs: 1_000,
    maxBackoffMs: 30_000,
    silenceLimitMs: 60_000,
    staleOnReturnMs: 35_000
}

type RelayStream = {
    eventSource: EventSource
    connectionId?: string
    requested: Set<string>
    synced: Set<string>
    lastHeardAt: number
}

type ReadyEvent = {
    connection?: string
    topics: string[]
}

export class RelayConnection implements RealtimeConnection {
    private handler?: RealtimeEventHandler
    private readonly channels = new Map<string, ChannelIdentifier>()
    private wanted = false
    private tabVisible = false
    private waitingToBeShown = false
    private attempt = 0
    private failures = 0
    private opening = false
    private changingTopics = false
    private stream?: RelayStream
    private reconnectTimer?: ReturnType<typeof setTimeout>
    private silenceTimer?: ReturnType<typeof setTimeout>

    constructor(
        private readonly api: Pick<TabletopApi, 'getRealtimeToken'>,
        private readonly relayHost: string,
        private readonly timing: RelayReconnectTiming = DEFAULT_RECONNECT_TIMING,
        private readonly random: () => number = Math.random,
        private readonly post: (url: string) => Promise<Response> = (url) =>
            fetch(url, { method: 'POST' })
    ) {}

    setHandler(handler: RealtimeEventHandler) {
        this.handler = handler
    }

    async addChannel(identifier: ChannelIdentifier): Promise<void> {
        if (this.channels.has(identifier.channelName)) {
            return
        }
        this.channels.set(identifier.channelName, identifier)
        this.channelsChanged()
    }

    async removeChannel(identifier: ChannelIdentifier): Promise<void> {
        if (!this.channels.delete(identifier.channelName)) {
            return
        }
        this.stream?.synced.delete(identifier.channelName)
        this.channelsChanged()
    }

    async connect(): Promise<void> {
        if (this.wanted) {
            return
        }
        this.wanted = true
        this.reopen()
    }

    disconnect() {
        this.wanted = false
        this.cancelReconnect()
        this.close()
    }

    tabVisibilityChanged(visible: boolean) {
        this.tabVisible = visible
        if (!visible || !this.wanted) {
            return
        }
        const stale =
            this.stream !== undefined &&
            Date.now() - this.stream.lastHeardAt > this.timing.staleOnReturnMs
        if (this.waitingToBeShown || this.reconnectTimer !== undefined || stale) {
            this.reopen()
        }
    }

    private channelsChanged() {
        if (!this.wanted) {
            return
        }
        if (this.stream?.connectionId !== undefined) {
            void this.changeTopics()
        } else if (
            !this.stream &&
            !this.opening &&
            !this.waitingToBeShown &&
            this.reconnectTimer === undefined
        ) {
            this.reopen()
        }
    }

    private reopen() {
        this.cancelReconnect()
        this.close()
        const attempt = this.attempt
        queueMicrotask(() => {
            if (attempt === this.attempt) {
                void this.open(attempt)
            }
        })
    }

    private close() {
        if (this.stream) {
            this.signalInterrupted(this.stream)
        }
        this.attempt++
        this.opening = false
        this.changingTopics = false
        this.waitingToBeShown = false
        clearTimeout(this.silenceTimer)
        this.silenceTimer = undefined
        this.stream?.eventSource.close()
        this.stream = undefined
    }

    private async open(attempt: number) {
        if (this.channels.size === 0) {
            return
        }
        this.opening = true
        const requested = new Set(this.channels.keys())
        let token: string
        try {
            token = await this.requestToken()
        } catch (error) {
            console.error('Failed to get a realtime token', error)
            if (attempt === this.attempt) {
                this.opening = false
                this.scheduleReconnect()
            }
            return
        }
        if (attempt !== this.attempt) {
            return
        }
        this.opening = false

        const stream: RelayStream = {
            eventSource: new EventSource(
                `${this.relayHost}/stream?${new URLSearchParams({ t: token })}`
            ),
            requested,
            synced: new Set(),
            lastHeardAt: Date.now()
        }
        this.stream = stream
        this.heardFrom(stream)
        stream.eventSource.addEventListener('ready', (event: MessageEvent<string>) => {
            this.heardFrom(stream)
            this.ready(stream, event.data)
        })
        stream.eventSource.addEventListener('keepalive', () => this.heardFrom(stream))
        stream.eventSource.addEventListener('evicted', () => this.evicted(stream))
        stream.eventSource.onmessage = (event: MessageEvent<string>) => {
            this.heardFrom(stream)
            this.receive(event.data)
        }
        stream.eventSource.onerror = () => this.failed(stream)
    }

    private signalInterrupted(stream: RelayStream) {
        const channels = new Set(
            [...stream.synced].flatMap((name) => this.channels.get(name)?.channel ?? [])
        )
        for (const channel of channels) {
            this.handler?.({ type: RealtimeEventType.Interrupted, channel })
        }
    }

    private heardFrom(stream: RelayStream) {
        if (stream !== this.stream) {
            return
        }
        stream.lastHeardAt = Date.now()
        clearTimeout(this.silenceTimer)
        this.silenceTimer = setTimeout(() => this.failed(stream), this.timing.silenceLimitMs)
    }

    private evicted(stream: RelayStream) {
        if (stream !== this.stream) {
            return
        }
        this.close()
        if (this.tabVisible) {
            this.scheduleReconnect()
        } else {
            this.waitingToBeShown = true
        }
    }

    private async changeTopics() {
        const stream = this.stream
        if (this.changingTopics || stream?.connectionId === undefined) {
            return
        }
        this.changingTopics = true
        const attempt = this.attempt
        stream.requested = new Set(this.channels.keys())
        try {
            const token = await this.requestToken()
            if (attempt !== this.attempt) {
                return
            }
            const response = await this.post(
                `${this.relayHost}/stream/${encodeURIComponent(stream.connectionId)}/topics?${new URLSearchParams({ t: token })}`
            )
            if (!response.ok) {
                throw new Error(`The relay refused the topic change with ${response.status}`)
            }
        } catch (error) {
            console.error('Failed to change realtime topics', error)
            if (attempt === this.attempt) {
                this.failed(stream)
            }
        }
    }

    private ready(stream: RelayStream, data: string) {
        const event = this.parseReady(data)
        if (stream !== this.stream || !event) {
            return
        }
        if (stream.connectionId === undefined) {
            stream.connectionId = event.connection
            this.failures = 0
        }
        this.changingTopics = false

        const carried = new Set(event.topics)
        const newlySynced = [...this.channels.values()].filter(
            (identifier) =>
                carried.has(identifier.channelName) && !stream.synced.has(identifier.channelName)
        )
        for (const identifier of newlySynced) {
            stream.synced.add(identifier.channelName)
        }
        for (const channel of new Set(newlySynced.map((identifier) => identifier.channel))) {
            this.handler?.({ type: RealtimeEventType.Discontinuity, channel })
        }

        if (!this.requestedTheCurrentChannels(stream)) {
            void this.changeTopics()
        }
    }

    private requestedTheCurrentChannels(stream: RelayStream): boolean {
        return (
            stream.requested.size === this.channels.size &&
            [...this.channels.keys()].every((topic) => stream.requested.has(topic))
        )
    }

    private failed(stream: RelayStream) {
        if (stream !== this.stream) {
            return
        }
        this.close()
        this.scheduleReconnect()
    }

    private requestToken(): Promise<string> {
        const relayStats = new ChannelIdentifier(NotificationChannel.RelayStats).channelName
        return this.api.getRealtimeToken(this.gameIds(), {
            relayStats: this.channels.has(relayStats)
        })
    }

    private gameIds(): string[] {
        return [...this.channels.values()]
            .filter((identifier) => identifier.channel === NotificationChannel.GameInstance)
            .map((identifier) => identifier.id)
            .filter((id): id is string => id !== undefined)
    }

    private receive(data: string) {
        const event = this.parseMessage(data)
        const identifier = event && this.channels.get(event.topic)
        if (!event || !identifier) {
            return
        }
        this.handler?.({
            type: RealtimeEventType.Data,
            channel: identifier.channel,
            data: event.message
        })
    }

    private parseReady(data: string): ReadyEvent | undefined {
        const parsed = this.parseJson(data)
        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'topics' in parsed &&
            this.isStringList(parsed.topics)
        ) {
            const connection =
                'connection' in parsed && typeof parsed.connection === 'string'
                    ? parsed.connection
                    : undefined
            return { connection, topics: parsed.topics }
        }
        console.error('Unreadable realtime ready event', data)
        return undefined
    }

    private parseMessage(data: string): { topic: string; message: unknown } | undefined {
        const parsed = this.parseJson(data)
        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'topic' in parsed &&
            typeof parsed.topic === 'string' &&
            'message' in parsed
        ) {
            return { topic: parsed.topic, message: parsed.message }
        }
        console.error('Unreadable realtime event', data)
        return undefined
    }

    private isStringList(value: unknown): value is string[] {
        return Array.isArray(value) && value.every((item) => typeof item === 'string')
    }

    private parseJson(data: string): unknown {
        try {
            return JSON.parse(data)
        } catch {
            return undefined
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimer !== undefined) {
            return
        }
        const backoff =
            this.failures === 0
                ? 0
                : Math.min(
                      this.timing.baseBackoffMs * 2 ** (this.failures - 1),
                      this.timing.maxBackoffMs
                  )
        this.failures++
        this.reconnectTimer = setTimeout(
            () => {
                this.reconnectTimer = undefined
                if (this.wanted) {
                    this.reopen()
                }
            },
            this.random() * this.timing.maxJitterMs + backoff
        )
    }

    private cancelReconnect() {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = undefined
    }
}
