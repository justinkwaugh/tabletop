import { Notification, NotificationType } from '@tabletop/common'

export type NotificationListener = (notification: Notification) => void
export type ConnectionCallback = () => void

export type NotificationService = {
    listenToGame(gameId: string, onConnect?: ConnectionCallback): void
    stopListeningToGame(): void
    addListener(type: NotificationType, listener: NotificationListener): void
    removeListener(type: NotificationType, listener: NotificationListener): void
}
