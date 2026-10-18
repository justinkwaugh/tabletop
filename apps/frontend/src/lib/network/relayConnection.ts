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
}

const DEFAULT_RECONNECT_TIMING: RelayReconnectTiming = {
    maxJitterMs: 5_000,
    baseBackoffMs: 1_000,
    maxBackoffMs: 30_000
}

type RelayStream = {
    eventSource: EventSource
    topics: Set<string>
}

export class RelayConnection implements RealtimeConnection {
    private handler?: RealtimeEventHandler
    private readonly channels = new Map<string, ChannelIdentifier>()
    private wanted = false
    private attempt = 0
    private failures = 0
    private live?: RelayStream
    private replacement?: RelayStream
    private reconnectTimer?: ReturnType<typeof setTimeout>

    constructor(
        private readonly api: Pick<TabletopApi, 'getRealtimeToken'>,
        private readonly relayHost: string,
        private readonly timing: RelayReconnectTiming = DEFAULT_RECONNECT_TIMING,
        private readonly random: () => number = Math.random
    ) {}

    setHandler(handler: RealtimeEventHandler) {
        this.handler = handler
    }

    async addChannel(identifier: ChannelIdentifier): Promise<void> {
        if (this.channels.has(identifier.channelName)) {
            return
        }
        this.channels.set(identifier.channelName, identifier)
        this.reopen()
    }

    async removeChannel(identifier: ChannelIdentifier): Promise<void> {
        if (!this.channels.delete(identifier.channelName)) {
            return
        }
        this.reopen()
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
        this.attempt++
        this.cancelReconnect()
        this.closeReplacement()
        this.closeLive()
    }

    private reopen() {
        if (!this.wanted) {
            return
        }
        this.cancelReconnect()
        const attempt = ++this.attempt
        queueMicrotask(() => {
            if (attempt === this.attempt) {
                void this.open(attempt)
            }
        })
    }

    private async open(attempt: number) {
        if (this.channels.size === 0) {
            this.closeReplacement()
            this.closeLive()
            return
        }
        const topics = new Set(this.channels.keys())
        let token: string
        try {
            token = await this.api.getRealtimeToken(this.gameIds())
        } catch (error) {
            console.error('Failed to get a realtime token', error)
            if (attempt === this.attempt) {
                this.scheduleReconnect()
            }
            return
        }
        if (attempt !== this.attempt) {
            return
        }

        this.closeReplacement()
        const stream: RelayStream = {
            eventSource: new EventSource(
                `${this.relayHost}/stream?${new URLSearchParams({ t: token })}`
            ),
            topics
        }
        this.replacement = stream
        stream.eventSource.addEventListener('ready', () => this.promote(stream))
        stream.eventSource.onmessage = (event: MessageEvent<string>) => this.receive(event.data)
        stream.eventSource.onerror = () => this.failed(stream)
    }

    private promote(stream: RelayStream) {
        if (stream !== this.replacement) {
            return
        }
        const continuous = this.live?.topics ?? new Set<string>()
        this.closeLive()
        this.live = stream
        this.replacement = undefined
        this.failures = 0

        const discontinuous = new Set(
            [...this.channels.values()]
                .filter((identifier) => !continuous.has(identifier.channelName))
                .map((identifier) => identifier.channel)
        )
        for (const channel of discontinuous) {
            this.handler?.({ type: RealtimeEventType.Discontinuity, channel })
        }
    }

    private failed(stream: RelayStream) {
        stream.eventSource.close()
        if (stream === this.live) {
            this.live = undefined
            if (!this.replacement) {
                this.scheduleReconnect()
            }
        } else if (stream === this.replacement) {
            this.replacement = undefined
            this.scheduleReconnect()
        }
    }

    private closeLive() {
        this.live?.eventSource.close()
        this.live = undefined
    }

    private closeReplacement() {
        this.replacement?.eventSource.close()
        this.replacement = undefined
    }

    private gameIds(): string[] {
        return [...this.channels.values()]
            .filter((identifier) => identifier.channel === NotificationChannel.GameInstance)
            .map((identifier) => identifier.id)
            .filter((id): id is string => id !== undefined)
    }

    private receive(data: string) {
        const event = this.parseEvent(data)
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

    private parseEvent(data: string): { topic: string; message: unknown } | undefined {
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
                this.reopen()
            },
            this.random() * this.timing.maxJitterMs + backoff
        )
    }

    private cancelReconnect() {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = undefined
    }
}
