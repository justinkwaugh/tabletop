import { NotificationSubscription } from '../../notifications/subscriptions/notificationSubscription.js'
import { NotificationSubscriptionIdentifier } from '../../notifications/subscriptions/notificationSubscriptionIdentifier.js'
export interface NotificationStore {
    findNotificationSubscriptions(topic: string): Promise<NotificationSubscription[]>
    upsertNotificationSubscription({
        subscription,
        topic
    }: {
        subscription: NotificationSubscription
        topic: string
    }): Promise<void>
    deleteNotificationSubscription(identifier: NotificationSubscriptionIdentifier): Promise<void>
}
