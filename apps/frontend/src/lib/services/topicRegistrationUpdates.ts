import { isTopicRegistrationsChangedNotification } from '@tabletop/common'
import {
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type NotificationService
} from '@tabletop/frontend-components'
import { refreshOnNotifications } from './notificationRefresh'

export function listenForTopicRegistrationChanges(
    notifications: Pick<NotificationService, 'addListener' | 'removeListener'>,
    refresh: () => Promise<void>
): () => void {
    return refreshOnNotifications(
        notifications,
        (event) => {
            if (event.channel !== NotificationChannel.User) return false
            if (isDataEvent(event))
                return isTopicRegistrationsChangedNotification(event.notification)
            return isDiscontinuityEvent(event)
        },
        refresh
    )
}
