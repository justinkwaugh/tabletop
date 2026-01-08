import { NotificationChannel } from '@tabletop/frontend-components'

export enum RealtimeEventType {
    Data = 'data',
    Discontinuity = 'discontinuity'
}

export type RealtimeEvent = {
    type: RealtimeEventType
    channel: NotificationChannel
    data?: unknown
}

export class ChannelIdentifier {
    constructor(
        readonly channel: NotificationChannel,
        readonly id?: string
    ) {}

    get channelName() {
        return this.id ? `${this.prefix()}-${this.id}` : this.prefix()
    }

    private prefix(): string {
        switch (this.channel) {
            case NotificationChannel.GameInstance:
                return 'game'
            case NotificationChannel.User:
                return 'user'
            case NotificationChannel.Global:
                return 'global'
        }
    }
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void

export interface RealtimeConnection {
    setHandler(handler: RealtimeEventHandler): void
    addChannel(identifier: ChannelIdentifier): Promise<void>
    removeChannel(identifier: ChannelIdentifier): Promise<void>
    connect(): Promise<void>
    disconnect(): void
}
