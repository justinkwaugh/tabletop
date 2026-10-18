import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Notification, NotificationCategory } from './notification.js'

export enum SystemNotificationAction {
    RelayStats = 'relayStats'
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

const RelayStatsNotificationValidator = Compile(RelayStatsNotification)

export function isRelayStatsNotification(
    notification: Notification
): notification is RelayStatsNotification {
    return RelayStatsNotificationValidator.Check(notification)
}
