import { LeagueNotification, TournamentNotification } from '@tabletop/common'
import * as Value from 'typebox/value'
import {
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type NotificationService
} from '@tabletop/frontend-components'
import { refreshOnNotifications } from './notificationRefresh'

/** Which Tournaments and Leagues a page shows; a kind left out never refreshes it. */
export interface CompetitionFilter {
    tournament?: (tournamentId: string) => boolean
    league?: (leagueId: string) => boolean
}

export const everyCompetition = () => true

function shows(filter: CompetitionFilter, notification: unknown): boolean {
    if (Value.Check(TournamentNotification, notification))
        return filter.tournament?.(notification.data.tournamentId) ?? false
    if (Value.Check(LeagueNotification, notification))
        return filter.league?.(notification.data.leagueId) ?? false
    return false
}

/** Refreshes once per relevant update, and once after the global or user stream reconnects. */
export function listenForCompetitionChanges(
    notifications: Pick<NotificationService, 'addListener' | 'removeListener'>,
    refresh: () => Promise<void>,
    filter: CompetitionFilter
): () => void {
    return refreshOnNotifications(
        notifications,
        (event) => {
            if (isDataEvent(event)) return shows(filter, event.notification)
            return (
                isDiscontinuityEvent(event) &&
                (event.channel === NotificationChannel.Global ||
                    event.channel === NotificationChannel.User)
            )
        },
        refresh
    )
}
