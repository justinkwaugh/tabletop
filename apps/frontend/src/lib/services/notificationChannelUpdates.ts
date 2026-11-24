import { isNotificationChannelsChangedNotification } from '@tabletop/common'
import {
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type NotificationService
} from '@tabletop/frontend-components'
import { refreshOnNotifications } from './notificationRefresh'

/** Refreshes when a chat channel (Telegram) connects or disconnects, and after the user stream reconnects. */
export function listenForNotificationChannelChanges(
    notifications: Pick<NotificationService, 'addListener' | 'removeListener'>,
    refresh: () => Promise<void>
): () => void {
    return refreshOnNotifications(
        notifications,
        (event) => {
            if (event.channel !== NotificationChannel.User) return false
            if (isDataEvent(event))
                return isNotificationChannelsChangedNotification(event.notification)
            return isDiscontinuityEvent(event)
        },
        refresh
    )
}
