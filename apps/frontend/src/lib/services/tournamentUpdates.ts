import { TournamentNotification } from '@tabletop/common'
import * as Value from 'typebox/value'
import {
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type NotificationListener,
    type NotificationService
} from '@tabletop/frontend-components'

export function listenForTournamentChanges(
    notifications: Pick<NotificationService, 'addListener' | 'removeListener'>,
    refresh: () => Promise<void>,
    tournamentId?: string
): () => void {
    let disposed = false
    let refreshing = false
    let pending = false
    const listener: NotificationListener = async (event) => {
        const reconnect =
            isDiscontinuityEvent(event) &&
            (event.channel === NotificationChannel.Global ||
                event.channel === NotificationChannel.User)
        const relevantUpdate =
            isDataEvent(event) &&
            Value.Check(TournamentNotification, event.notification) &&
            (!tournamentId || event.notification.data.tournament.id === tournamentId)
        if (!reconnect && !relevantUpdate) return
        pending = true
        if (refreshing) return
        refreshing = true
        try {
            while (pending && !disposed) {
                pending = false
                await refresh()
            }
        } finally {
            refreshing = false
        }
    }
    notifications.addListener(listener)
    return () => {
        disposed = true
        notifications.removeListener(listener)
    }
}
