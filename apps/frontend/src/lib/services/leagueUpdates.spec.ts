import { describe, expect, it, vi } from 'vitest'
import { NotificationCategory } from '@tabletop/common'
import {
    NotificationChannel,
    NotificationEventType,
    type NotificationListener
} from '@tabletop/frontend-components'
import { listenForLeagueChanges } from './leagueUpdates'

const update = (leagueId: string) => ({
    eventType: NotificationEventType.Data,
    channel: NotificationChannel.Global,
    notification: {
        id: 'notification',
        type: NotificationCategory.League,
        action: 'update',
        data: { leagueId }
    }
})
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

describe('league realtime updates', () => {
    it('refreshes a league page for that league or a reconnection, until it closes', async () => {
        const notifications = connection()
        const refresh = vi.fn(async () => undefined)
        const stop = listenForLeagueChanges(notifications, refresh, 'league')
        await notifications.emit(update('other'))
        await notifications.emit({
            ...update('league'),
            notification: {
                ...update('league').notification,
                type: NotificationCategory.Tournament
            }
        })
        expect(refresh).not.toHaveBeenCalled()
        await notifications.emit(update('league'))
        await notifications.emit({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.Global
        })
        expect(refresh).toHaveBeenCalledTimes(2)
        stop()
        expect(notifications.listeners.size).toBe(0)
    })

    it('refreshes the league list for any league', async () => {
        const notifications = connection()
        const refresh = vi.fn(async () => undefined)
        listenForLeagueChanges(notifications, refresh)
        await notifications.emit(update('other'))
        expect(refresh).toHaveBeenCalledOnce()
    })
})
