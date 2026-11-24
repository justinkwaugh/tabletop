import { nanoid } from 'nanoid'
import {
    NotificationCategory,
    SystemNotificationAction,
    type TopicRegistrationsChangedNotification
} from '@tabletop/common'
import { NotificationDistributionMethod, type NotificationService } from './notificationService.js'

// A failed push only leaves an open Notifications page stale until it reloads.
export async function announceTopicRegistrationsChanged(
    notifications: Pick<NotificationService, 'sendNotification'>,
    topics: string[]
): Promise<void> {
    const notification: TopicRegistrationsChangedNotification = {
        id: nanoid(),
        type: NotificationCategory.System,
        action: SystemNotificationAction.TopicRegistrationsChanged,
        data: {}
    }
    try {
        await notifications.sendNotification({
            notification,
            topics,
            channels: [NotificationDistributionMethod.Topical]
        })
    } catch (error) {
        console.error('Could not announce a topic registration change', error)
    }
}
