import { Notification, NotificationCategory } from '@tabletop/common'

export enum NotificationEventType {
    Data = 'data',
    Discontinuity = 'discontinuity'
}

export type DiscontinuityEvent = {
    eventType: NotificationEventType
    category: NotificationCategory
}

export type DataEvent = {
    eventType: NotificationEventType
    category: NotificationCategory
    notification: Notification
}

export type NotificationEvent = DiscontinuityEvent | DataEvent

export function isDataEvent(event: NotificationEvent): event is DataEvent {
    return event.eventType === NotificationEventType.Data
}

export function isDiscontinuityEvent(event: NotificationEvent): event is DiscontinuityEvent {
    return event.eventType === NotificationEventType.Discontinuity
}

export type NotificationListener = (event: NotificationEvent) => void

export type NotificationService = {
    listenToGame(gameId: string): void
    stopListeningToGame(gameId: string): void
    addListener(type: NotificationCategory, listener: NotificationListener): void
    removeListener(type: NotificationCategory, listener: NotificationListener): void
}
