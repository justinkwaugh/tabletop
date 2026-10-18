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
            case NotificationChannel.RelayStats:
                return 'relay-stats'
        }
    }
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void

export interface RealtimeTransport {
    setHandler(handler: RealtimeEventHandler): void
    addChannel(identifier: ChannelIdentifier): Promise<void>
    removeChannel(identifier: ChannelIdentifier): Promise<void>
    connect(): Promise<void>
    disconnect(): void
}

export interface RealtimeConnection extends RealtimeTransport {
    tabVisibilityChanged(visible: boolean): void
}

export function closedWhileHidden(transport: RealtimeTransport): RealtimeConnection {
    let wanted = false
    let visible = false
    const apply = async () => {
        if (wanted && visible) {
            await transport.connect()
        } else {
            transport.disconnect()
        }
    }
    return {
        setHandler: (handler) => transport.setHandler(handler),
        addChannel: (identifier) => transport.addChannel(identifier),
        removeChannel: (identifier) => transport.removeChannel(identifier),
        connect: async () => {
            wanted = true
            await apply()
        },
        disconnect: () => {
            wanted = false
            void apply()
        },
        tabVisibilityChanged: (isVisible) => {
            visible = isVisible
            apply().catch((error) =>
                console.error('Failed to connect to realtime connection', error)
            )
        }
    }
}
