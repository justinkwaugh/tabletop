import {
    GameCreateNotification,
    GameDeleteNotification,
    GameUpdateNotification,
    type Game
} from '@tabletop/common'
import {
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type NotificationListener,
    type NotificationService
} from '@tabletop/frontend-components'
import * as Value from 'typebox/value'

export type GameListChange = { game: Game } | { discontinuity: true }

export function listenForGameListChanges(
    notifications: Pick<NotificationService, 'addListener' | 'removeListener'>,
    onChange: (change: GameListChange) => Promise<void>
): () => void {
    const listener: NotificationListener = async (event) => {
        if (isDataEvent(event)) {
            const notification = event.notification
            if (
                Value.Check(GameUpdateNotification, notification) ||
                Value.Check(GameDeleteNotification, notification) ||
                Value.Check(GameCreateNotification, notification)
            )
                await onChange({ game: notification.data.game })
        } else if (isDiscontinuityEvent(event) && event.channel === NotificationChannel.User) {
            await onChange({ discontinuity: true })
        }
    }
    notifications.addListener(listener)
    return () => notifications.removeListener(listener)
}
