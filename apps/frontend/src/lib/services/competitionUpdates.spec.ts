import { describe, expect, it, vi } from 'vitest'
import { NotificationCategory, type Tournament } from '@tabletop/common'
import {
    NotificationChannel,
    NotificationEventType,
    type NotificationListener
} from '@tabletop/frontend-components'
import { everyCompetition, listenForCompetitionChanges } from './competitionUpdates'

const tournament: Tournament = {
    id: 'event',
    name: 'Mini',
    description: '',
    organizerId: 'admin',
    status: 'open',
    revision: 2,
    entrants: [],
    stages: [],
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
const tournamentUpdate = {
    eventType: NotificationEventType.Data,
    channel: NotificationChannel.Global,
    notification: {
        id: 'notification',
        type: NotificationCategory.Tournament,
        action: 'update',
        data: { tournamentId: tournament.id, revision: tournament.revision }
    }
}
const leagueUpdate = (leagueId: string) => ({
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

describe('competition realtime reconciliation', () => {
    it('reconciles updates and reconnects, and unregisters when the page closes', async () => {
        const notifications = connection()
        const refresh = vi.fn(async () => undefined)
        const stop = listenForCompetitionChanges(notifications, refresh, {
            tournament: everyCompetition
        })
        await notifications.emit(tournamentUpdate)
        await notifications.emit({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.Global
        })
        expect(refresh).toHaveBeenCalledTimes(2)
        stop()
        expect(notifications.listeners.size).toBe(0)
        await notifications.emit(tournamentUpdate)
        expect(refresh).toHaveBeenCalledTimes(2)
    })
    it('only refreshes a detail page for that tournament or a user/global reconnection', async () => {
        const notifications = connection()
        const refresh = vi.fn(async () => undefined)
        listenForCompetitionChanges(notifications, refresh, {
            tournament: (tournamentId) => tournamentId === 'different-event'
        })
        await notifications.emit(tournamentUpdate)
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
        listenForCompetitionChanges(notifications, refresh, { tournament: everyCompetition })
        const first = notifications.emit(tournamentUpdate)
        await notifications.emit(tournamentUpdate)
        await notifications.emit(tournamentUpdate)
        expect(refresh).toHaveBeenCalledOnce()
        release()
        await first
        expect(refresh).toHaveBeenCalledTimes(2)
    })
    it('refreshes a league page for its League and its Groups only, once per reconnect', async () => {
        const notifications = connection()
        const refresh = vi.fn(async () => undefined)
        listenForCompetitionChanges(notifications, refresh, {
            league: (leagueId) => leagueId === 'league',
            tournament: (tournamentId) => tournamentId === tournament.id
        })
        await notifications.emit(leagueUpdate('other'))
        await notifications.emit({
            ...tournamentUpdate,
            notification: {
                ...tournamentUpdate.notification,
                data: { tournamentId: 'elsewhere', revision: 1 }
            }
        })
        expect(refresh).not.toHaveBeenCalled()
        await notifications.emit(leagueUpdate('league'))
        await notifications.emit(tournamentUpdate)
        expect(refresh).toHaveBeenCalledTimes(2)
        await notifications.emit({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.Global
        })
        expect(refresh).toHaveBeenCalledTimes(3)
    })
    it('ignores a kind the page does not watch', async () => {
        const notifications = connection()
        const refresh = vi.fn(async () => undefined)
        listenForCompetitionChanges(notifications, refresh, { league: everyCompetition })
        await notifications.emit(tournamentUpdate)
        expect(refresh).not.toHaveBeenCalled()
        await notifications.emit(leagueUpdate('any'))
        expect(refresh).toHaveBeenCalledOnce()
    })
})
