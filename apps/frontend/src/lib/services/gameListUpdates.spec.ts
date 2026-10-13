import { describe, expect, it, vi } from 'vitest'
import {
    GameNotificationAction,
    GameStatus,
    NotificationCategory,
    PlayerStatus,
    type Game
} from '@tabletop/common'
import {
    NotificationChannel,
    NotificationEventType,
    type NotificationListener
} from '@tabletop/frontend-components'
import { changesFinishedGames, listenForGameListChanges } from './gameListUpdates'

function game(overrides: Partial<Game> = {}): Game {
    return {
        id: 'game',
        name: 'Game',
        typeId: 'test',
        ownerId: 'user',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date('2026-09-01'),
        winningPlayerIds: [],
        players: [
            {
                id: 'player',
                userId: 'user',
                name: 'Player',
                status: PlayerStatus.Joined,
                isHuman: true
            }
        ],
        ...overrides
    }
}

function notification(action: GameNotificationAction, changed: Game) {
    return {
        eventType: NotificationEventType.Data,
        channel: NotificationChannel.User,
        notification: {
            id: 'notification',
            type: NotificationCategory.Game,
            action,
            data: { game: changed }
        }
    }
}

function connection() {
    const listeners = new Set<NotificationListener>()
    return {
        listeners,
        addListener: (listener: NotificationListener) => {
            listeners.add(listener)
        },
        removeListener: (listener: NotificationListener) => {
            listeners.delete(listener)
        },
        emit: async (event: Parameters<NotificationListener>[0]) => {
            await Promise.all([...listeners].map((listener) => listener(event)))
        }
    }
}

describe('game list realtime reconciliation', () => {
    it('recognizes changes that can alter the finished games', () => {
        expect(changesFinishedGames({ discontinuity: true })).toBe(true)
        expect(changesFinishedGames({ game: game({ status: GameStatus.Finished }) })).toBe(true)
        expect(changesFinishedGames({ game: game({ everFinished: true }) })).toBe(true)
        expect(changesFinishedGames({ game: game() })).toBe(false)
        expect(changesFinishedGames({ game: game({ status: GameStatus.WaitingForPlayers }) })).toBe(
            false
        )
    })

    it('refreshes only for relevant game changes and user reconnections', async () => {
        const notifications = connection()
        const refresh = vi.fn(async () => undefined)
        const stop = listenForGameListChanges(notifications, changesFinishedGames, refresh)

        await notifications.emit(notification(GameNotificationAction.Update, game()))
        await notifications.emit(
            notification(GameNotificationAction.AddActions, game({ status: GameStatus.Finished }))
        )
        await notifications.emit({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.GameInstance
        })
        expect(refresh).not.toHaveBeenCalled()

        await notifications.emit(
            notification(GameNotificationAction.Update, game({ status: GameStatus.Finished }))
        )
        await notifications.emit(
            notification(GameNotificationAction.Update, game({ everFinished: true }))
        )
        await notifications.emit(
            notification(GameNotificationAction.Delete, game({ status: GameStatus.Finished }))
        )
        await notifications.emit({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.User
        })
        expect(refresh).toHaveBeenCalledTimes(4)

        stop()
        expect(notifications.listeners.size).toBe(0)
    })

    it('coalesces changes received during a refresh without losing the last one', async () => {
        const notifications = connection()
        let release = () => {}
        const pending = new Promise<void>((resolve) => {
            release = resolve
        })
        const refresh = vi.fn(async () => {
            await pending
        })
        listenForGameListChanges(notifications, changesFinishedGames, refresh)
        const finished = notification(
            GameNotificationAction.Update,
            game({ status: GameStatus.Finished })
        )
        const first = notifications.emit(finished)
        await notifications.emit(finished)
        await notifications.emit(finished)
        expect(refresh).toHaveBeenCalledOnce()
        release()
        await first
        expect(refresh).toHaveBeenCalledTimes(2)
    })
})
