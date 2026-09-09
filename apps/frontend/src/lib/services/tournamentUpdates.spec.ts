import { describe, expect, it, vi } from 'vitest'
import { NotificationCategory, type Tournament } from '@tabletop/common'
import {
    NotificationChannel,
    NotificationEventType,
    type NotificationListener
} from '@tabletop/frontend-components'
import { listenForTournamentChanges } from './tournamentUpdates'

const tournament: Tournament = {
    id: 'event',
    name: 'Mini',
    description: '',
    organizerId: 'admin',
    status: 'open',
    revision: 2,
    entrantCount: 0,
    createdAt: 1,
    updatedAt: 2,
    publishedAt: 2,
    format: { kind: 'mini', stages: [{ id: 'main', name: 'Main', gamesPerEntrant: 4 }] },
    rules: {
        titleId: 'sol',
        tableSize: 4,
        registration: { kind: 'whenFull', capacity: 8 },
        concurrency: 2,
        gameConfig: {},
        scoring: 'splitWinsV1'
    }
}
const update = {
    eventType: NotificationEventType.Data,
    channel: NotificationChannel.Global,
    notification: {
        id: 'notification',
        type: NotificationCategory.Tournament,
        action: 'update',
        data: { tournament }
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

describe('tournament realtime reconciliation', () => {
    it('reconciles updates and reconnects, and unregisters when the page closes', async () => {
        const notifications = connection()
        const refresh = vi.fn(async () => undefined)
        const stop = listenForTournamentChanges(notifications, refresh)
        await notifications.emit(update)
        await notifications.emit({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.Global
        })
        expect(refresh).toHaveBeenCalledTimes(2)
        stop()
        expect(notifications.listeners.size).toBe(0)
        await notifications.emit(update)
        expect(refresh).toHaveBeenCalledTimes(2)
    })
    it('only refreshes a detail page for that tournament or a user/global reconnection', async () => {
        const notifications = connection()
        const refresh = vi.fn(async () => undefined)
        listenForTournamentChanges(notifications, refresh, 'different-event')
        await notifications.emit(update)
        await notifications.emit({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.GameInstance
        })
        expect(refresh).not.toHaveBeenCalled()
        await notifications.emit({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.User
        })
        expect(refresh).toHaveBeenCalledOnce()
    })
    it('coalesces notifications received during a canonical read without losing the final change', async () => {
        const notifications = connection()
        let release = () => {}
        const pending = new Promise<void>((resolve) => {
            release = resolve
        })
        const refresh = vi.fn(async () => {
            await pending
        })
        listenForTournamentChanges(notifications, refresh)
        const first = notifications.emit(update)
        await notifications.emit(update)
        await notifications.emit(update)
        expect(refresh).toHaveBeenCalledOnce()
        release()
        await first
        expect(refresh).toHaveBeenCalledTimes(2)
    })
})
