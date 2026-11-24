import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Notification, NotificationCategory } from './notification.js'

export enum SystemNotificationAction {
    RelayStats = 'relayStats',
    NotificationChannelsChanged = 'notificationChannelsChanged'
}

export type RelayStatsNotification = Type.Static<typeof RelayStatsNotification>
export const RelayStatsNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.System),
            action: Type.Literal(SystemNotificationAction.RelayStats),
            data: Type.Object({
                connections: Type.Integer({ minimum: 0 }),
                accounts: Type.Integer({ minimum: 0 })
            })
        })
    ])
)

export type RelayCounts = RelayStatsNotification['data']

const RelayStatsNotificationValidator = Compile(RelayStatsNotification)

export function isRelayStatsNotification(
    notification: Notification
): notification is RelayStatsNotification {
    return RelayStatsNotificationValidator.Check(notification)
}

/** Sent on a user's topic when a chat channel (Telegram) connects or disconnects, so an open Notifications page reloads. */
export type NotificationChannelsChangedNotification = Type.Static<
    typeof NotificationChannelsChangedNotification
>
export const NotificationChannelsChangedNotification = Type.Evaluate(
    Type.Intersect([
        Type.Omit(Notification, ['type', 'action', 'data']),
        Type.Object({
            type: Type.Literal(NotificationCategory.System),
            action: Type.Literal(SystemNotificationAction.NotificationChannelsChanged),
            data: Type.Object({})
        })
    ])
)

const NotificationChannelsChangedNotificationValidator = Compile(
    NotificationChannelsChangedNotification
)

export function isNotificationChannelsChangedNotification(
    notification: unknown
): notification is NotificationChannelsChangedNotification {
    return NotificationChannelsChangedNotificationValidator.Check(notification)
}
