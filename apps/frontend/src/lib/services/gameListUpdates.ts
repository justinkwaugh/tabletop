import {
    GameCreateNotification,
    GameDeleteNotification,
    GameStatus,
    GameUpdateNotification,
    type Game
} from '@tabletop/common'
import {
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type NotificationEvent,
    type NotificationService
} from '@tabletop/frontend-components'
import * as Value from 'typebox/value'
import { refreshOnNotifications } from './notificationRefresh'

export type GameListChange = { game: Game } | { discontinuity: true }

export function listenForGameListChanges(
    notifications: Pick<NotificationService, 'addListener' | 'removeListener'>,
    isRelevant: (change: GameListChange) => boolean,
    refresh: () => Promise<void>
): () => void {
    return refreshOnNotifications(
        notifications,
        (event) => {
            const change = gameListChange(event)
            return change !== undefined && isRelevant(change)
        },
        refresh
    )
}

export function changesFinishedGames(change: GameListChange): boolean {
    return (
        'discontinuity' in change ||
        change.game.status === GameStatus.Finished ||
        change.game.everFinished === true
    )
}

function gameListChange(event: NotificationEvent): GameListChange | undefined {
    if (isDataEvent(event)) {
        const notification = event.notification
        if (
            Value.Check(GameUpdateNotification, notification) ||
            Value.Check(GameDeleteNotification, notification) ||
            Value.Check(GameCreateNotification, notification)
        )
            return { game: notification.data.game }
    } else if (isDiscontinuityEvent(event) && event.channel === NotificationChannel.User) {
        return { discontinuity: true }
    }
    return undefined
}
