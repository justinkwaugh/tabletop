import * as Type from 'typebox'
import { Notification, NotificationCategory } from './notification.js'

export const TournamentNotification = Type.Object({
    ...Notification.properties,
    type: Type.Literal(NotificationCategory.Tournament),
    action: Type.Literal('update'),
    data: Type.Object({ tournamentId: Type.String(), revision: Type.Integer() })
})
export type TournamentNotification = Type.Static<typeof TournamentNotification>
