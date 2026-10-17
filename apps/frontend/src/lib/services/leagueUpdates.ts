import { LeagueNotification } from '@tabletop/common'
import * as Value from 'typebox/value'
import {
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type NotificationService
} from '@tabletop/frontend-components'
import { refreshOnNotifications } from './notificationRefresh'

export function listenForLeagueChanges(
    notifications: Pick<NotificationService, 'addListener' | 'removeListener'>,
    refresh: () => Promise<void>,
    leagueId?: string
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
                Value.Check(LeagueNotification, event.notification) &&
                (!leagueId || event.notification.data.leagueId === leagueId)
            return reconnect || relevantUpdate
        },
        refresh
    )
}
