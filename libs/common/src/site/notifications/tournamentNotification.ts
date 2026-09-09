import * as Type from 'typebox'
import { Notification, NotificationCategory } from './notification.js'
import { Tournament } from '../tournament.js'

export const TournamentNotification = Type.Object({
    ...Notification.properties,
    type: Type.Literal(NotificationCategory.Tournament),
    action: Type.Literal('update'),
    data: Type.Object({ tournament: Tournament })
})
export type TournamentNotification = Type.Static<typeof TournamentNotification>
