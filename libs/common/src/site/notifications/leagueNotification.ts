import * as Type from 'typebox'
import { Notification, NotificationCategory } from './notification.js'

export const LeagueNotification = Type.Object({
    ...Notification.properties,
    type: Type.Literal(NotificationCategory.League),
    action: Type.Literal('update'),
    data: Type.Object({ leagueId: Type.String() })
})
export type LeagueNotification = Type.Static<typeof LeagueNotification>
