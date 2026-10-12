import { TournamentNotification } from '@tabletop/common'
import * as Value from 'typebox/value'
import {
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type NotificationService
} from '@tabletop/frontend-components'
import { refreshOnNotifications } from './notificationRefresh'

export function listenForTournamentChanges(
    notifications: Pick<NotificationService, 'addListener' | 'removeListener'>,
    refresh: () => Promise<void>,
    tournamentId?: string
): () => void {
    return refreshOnNotifications(
        notifications,
        (event) => {
            const reconnect =
                isDiscontinuityEvent(event) &&
                (event.channel === NotificationChannel.Global ||
                    event.channel === NotificationChannel.User)
            const relevantUpdate =
                isDataEvent(event) &&
                Value.Check(TournamentNotification, event.notification) &&
                (!tournamentId || event.notification.data.tournamentId === tournamentId)
            return reconnect || relevantUpdate
        },
        refresh
    )
}
