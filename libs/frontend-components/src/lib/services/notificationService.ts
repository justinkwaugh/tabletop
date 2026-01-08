import { Notification } from '@tabletop/common'

export enum NotificationChannel {
    GameInstance = 'gameInstance',
    User = 'user',
    Global = 'global'
}

export enum NotificationEventType {
    Data = 'data',
    Discontinuity = 'discontinuity'
}

export type DiscontinuityEvent = {
    eventType: NotificationEventType
    channel: NotificationChannel
}

export type DataEvent = {
    eventType: NotificationEventType
    channel: NotificationChannel
    notification: Notification
}

export type NotificationEvent = DiscontinuityEvent | DataEvent

export function isDataEvent(event: NotificationEvent): event is DataEvent {
    return event.eventType === NotificationEventType.Data
}

export function isDiscontinuityEvent(event: NotificationEvent): event is DiscontinuityEvent {
    return event.eventType === NotificationEventType.Discontinuity
}

export type NotificationListener = (event: NotificationEvent) => Promise<void>

export type NotificationService = {
    listenToGame(gameId: string): void
    stopListeningToGame(gameId: string): void
    addListener(listener: NotificationListener): void
    removeListener(listener: NotificationListener): void

    // These should probably not be here
    onMounted(): void
    showPrompt(): void
    hidePrompt(): void
    shouldShowPrompt(): boolean
    hasWebNotificationPermission(): boolean
    canAskforWebNotificationPermission(): boolean
    requestWebNotificationPermission(): Promise<boolean>
}
