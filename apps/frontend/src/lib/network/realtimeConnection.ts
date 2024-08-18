import type { NotificationCategory } from '@tabletop/common'

export enum RealtimeEventType {
    Data = 'data',
    Discontinuity = 'discontinuity'
}

export type RealtimeEvent = {
    type: RealtimeEventType
    category: NotificationCategory
    data?: unknown
}

export class Channel {
    constructor(
        readonly category: NotificationCategory,
        readonly id?: string
    ) {}
    get channelName() {
        return this.id ? `${this.category}-${this.id}` : this.category
    }
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void

export interface RealtimeConnection {
    setHandler(handler: RealtimeEventHandler): void
    addChannel(channel: Channel): Promise<void>
    removeChannel(channel: Channel): Promise<void>
    connect(): Promise<void>
    disconnect(): void
}
