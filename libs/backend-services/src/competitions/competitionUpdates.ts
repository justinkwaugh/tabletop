import { nanoid } from 'nanoid'
import type { LeagueNotification, TournamentNotification } from '@tabletop/common'
import {
    NotificationDistributionMethod,
    type NotificationService
} from '../notifications/notificationService.js'

type CompetitionUpdate =
    Pick<TournamentNotification, 'type' | 'data'> | Pick<LeagueNotification, 'type' | 'data'>

/** Tells open competition pages to reload. A failed send never fails the change itself. */
export async function sendCompetitionUpdate(
    notifications: Pick<NotificationService, 'sendNotification'>,
    update: CompetitionUpdate,
    topics: string[] | (() => Promise<string[]>)
): Promise<void> {
    try {
        await notifications.sendNotification({
            notification: { id: nanoid(), action: 'update', ...update },
            topics: Array.isArray(topics) ? topics : await topics(),
            channels: [NotificationDistributionMethod.Topical]
        })
    } catch (error) {
        console.error(`Realtime ${update.type} update failed`, error)
    }
}
