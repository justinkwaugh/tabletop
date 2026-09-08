import { describe, expect, it, vi } from 'vitest'
import {
    ActionSource,
    GameNotificationAction,
    GameStatus,
    NotificationCategory,
    type Game,
    type Notification,
    type Visibility
} from '@tabletop/common'
import { DummyNotificationService } from '../harness/dummyNotificationService.js'
import { NotificationChannel, NotificationEventType } from '../services/notificationService.js'
import { GameNotifications } from './gameNotifications.js'
import { ServerActionHandling, type ReconciliationUpdate } from './gameReconciliation.js'

function fixture({ hotseat = false, usesProjection = true } = {}) {
    const game: Game = {
        id: 'game',
        typeId: 'title',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'owner',
        name: 'Game',
        players: [],
        config: {},
        hotseat,
        createdAt: new Date('2026-09-01T00:00:00Z'),
        winningPlayerIds: []
    }
    const service = new DummyNotificationService()
    const subscribe = vi.spyOn(service, 'listenToGame')
    const unsubscribe = vi.spyOn(service, 'stopListeningToGame')
    const view = { host: false }
    const delivery = {
        usesProjection,
        acceptsPerspective: vi.fn(
            (perspective: Visibility.Perspective) =>
                perspective.kind === 'player' && perspective.playerId === 'player-one'
        ),
        hasHostContext: () => view.host,
        refreshHost: vi.fn(async () => {}),
        enqueue: vi.fn(async (_update: ReconciliationUpdate) => {}),
        recover: vi.fn(async () => {}),
        onDeleted: vi.fn()
    }
    const notifications = new GameNotifications(game, service, delivery)
    const emit = async (
        action: GameNotificationAction,
        data: Notification['data'],
        type = NotificationCategory.Game
    ) => {
        await service.emit({
            eventType: NotificationEventType.Data,
            channel: NotificationChannel.User,
            notification: { id: 'notification', type, action, data }
        })
    }
    const gap = (channel: NotificationChannel) =>
        service.emit({ eventType: NotificationEventType.Discontinuity, channel })
    const action = {
        id: 'action',
        gameId: game.id,
        type: 'place',
        source: ActionSource.User,
        createdAt: '2026-09-01T00:00:00Z',
        forwardPatch: [],
        undoPatch: []
    }
    const projected = {
        game,
        actions: [action],
        perspective: { kind: 'player', playerId: 'player-one' }
    }
    return {
        game,
        action,
        projected,
        service,
        subscribe,
        unsubscribe,
        view,
        delivery,
        notifications,
        emit,
        gap
    }
}

describe('GameNotifications', () => {
    it('owns one subscription, ignores stopped delivery, and can restart', async () => {
        const f = fixture()
        f.notifications.start()
        f.notifications.start()
        expect(f.subscribe).toHaveBeenCalledExactlyOnceWith(f.game.id)
        await f.emit(GameNotificationAction.AddProjectedActions, f.projected)
        expect(f.delivery.enqueue).toHaveBeenCalledOnce()
        f.notifications.stop()
        f.notifications.stop()
        expect(f.unsubscribe).toHaveBeenCalledExactlyOnceWith(f.game.id)
        await f.emit(GameNotificationAction.AddProjectedActions, f.projected)
        expect(f.delivery.enqueue).toHaveBeenCalledOnce()
        f.notifications.start()
        await f.emit(GameNotificationAction.AddProjectedActions, f.projected)
        expect(f.delivery.enqueue).toHaveBeenCalledTimes(2)
        f.notifications.stop()
    })

    it('does not subscribe Hotseat Games', async () => {
        const f = fixture({ hotseat: true })
        f.notifications.start()
        await f.gap(NotificationChannel.GameInstance)
        f.notifications.stop()
        expect(f.subscribe).not.toHaveBeenCalled()
        expect(f.unsubscribe).not.toHaveBeenCalled()
        expect(f.delivery.enqueue).not.toHaveBeenCalled()
    })

    it('ignores unrelated categories, Games, and unsupported notifications', async () => {
        const f = fixture()
        f.notifications.start()
        f.view.host = true
        await f.emit(GameNotificationAction.AddActions, {}, NotificationCategory.User)
        await f.emit(GameNotificationAction.AddActions, { game: { id: 'another-game' } })
        await f.emit(GameNotificationAction.Update, { game: f.game })
        expect(f.delivery.refreshHost).not.toHaveBeenCalled()
        expect(f.delivery.enqueue).not.toHaveBeenCalled()
        expect(f.delivery.recover).not.toHaveBeenCalled()
    })

    it('reads the current perspective before decoding projected payloads', async () => {
        const f = fixture()
        f.notifications.start()
        const spectator = { kind: 'spectator' }
        await f.emit(GameNotificationAction.AddProjectedActions, {
            game: f.game,
            perspective: spectator
        })
        expect(f.delivery.recover).not.toHaveBeenCalled()
        f.delivery.acceptsPerspective.mockImplementation((p) => p.kind === 'spectator')
        await f.emit(GameNotificationAction.AddProjectedActions, f.projected)
        expect(f.delivery.enqueue).not.toHaveBeenCalled()
        await f.emit(GameNotificationAction.AddProjectedActions, {
            ...f.projected,
            game: { ...f.game, createdAt: f.game.createdAt.toISOString() },
            perspective: spectator
        })
        expect(f.delivery.enqueue).toHaveBeenCalledExactlyOnceWith({
            kind: 'actions',
            handling: ServerActionHandling.ApplyProcessed,
            game: f.game,
            actions: [{ ...f.action, createdAt: f.game.createdAt }]
        })
    })

    it('routes legacy Actions for canonical execution', async () => {
        const f = fixture({ usesProjection: false })
        f.notifications.start()
        await f.emit(GameNotificationAction.AddActions, { game: f.game, actions: [f.action] })
        expect(f.delivery.enqueue).toHaveBeenCalledExactlyOnceWith({
            kind: 'actions',
            handling: ServerActionHandling.Execute,
            game: f.game,
            actions: [{ ...f.action, createdAt: f.game.createdAt }]
        })
    })

    it('routes projected replacements only for the current perspective', async () => {
        const f = fixture()
        f.notifications.start()
        const data = {
            game: f.game,
            actionReplay: { startIndex: 0, actions: [f.action] },
            checksum: 123,
            perspective: f.projected.perspective
        }
        await f.emit(GameNotificationAction.ReplaceProjectedActions, {
            ...data,
            perspective: { kind: 'spectator' }
        })
        expect(f.delivery.enqueue).not.toHaveBeenCalled()
        await f.emit(GameNotificationAction.ReplaceProjectedActions, data)
        expect(f.delivery.enqueue).toHaveBeenCalledExactlyOnceWith({
            kind: 'replacement',
            replay: { startIndex: 0, actions: [{ ...f.action, createdAt: f.game.createdAt }] },
            checksum: 123,
            game: f.game,
            perspective: data.perspective
        })
    })

    it('preserves legacy Undo manifests and converts redone Actions', async () => {
        const f = fixture()
        f.notifications.start()
        const manifest = { startIndex: 0, actionIds: ['action'], userActionIds: ['action'] }
        await f.emit(GameNotificationAction.UndoAction, {
            game: f.game,
            canonicalReplay: manifest,
            redoneActions: [f.action],
            checksum: 123
        })
        expect(f.delivery.enqueue).toHaveBeenCalledExactlyOnceWith({
            kind: 'manifest',
            manifest,
            redoneActions: [{ ...f.action, createdAt: f.game.createdAt }],
            checksum: 123,
            game: f.game
        })
    })

    it.each([
        GameNotificationAction.AddActions,
        GameNotificationAction.AddProjectedActions,
        GameNotificationAction.ReplaceProjectedActions,
        GameNotificationAction.UndoAction
    ])(
        'refreshes retained Host View for %s without applying a projected payload',
        async (action) => {
            const f = fixture()
            f.notifications.start()
            f.view.host = true
            await f.emit(action, { game: f.game })
            expect(f.delivery.refreshHost).toHaveBeenCalledOnce()
            expect(f.delivery.enqueue).not.toHaveBeenCalled()
            expect(f.delivery.recover).not.toHaveBeenCalled()
            f.view.host = false
            await f.emit(GameNotificationAction.AddProjectedActions, f.projected)
            expect(f.delivery.enqueue).toHaveBeenCalledOnce()
        }
    )

    it.each([true, false])(
        'queues the appropriate channel discontinuities with projection %s',
        async (usesProjection) => {
            const f = fixture({ usesProjection })
            f.notifications.start()
            await f.gap(NotificationChannel.Global)
            expect(f.delivery.enqueue).not.toHaveBeenCalled()
            await f.gap(NotificationChannel.User)
            expect(f.delivery.enqueue).toHaveBeenCalledTimes(usesProjection ? 1 : 0)
            await f.gap(NotificationChannel.GameInstance)
            expect(f.delivery.enqueue).toHaveBeenCalledTimes(usesProjection ? 2 : 1)
            expect(f.delivery.enqueue).toHaveBeenLastCalledWith({ kind: 'synchronize' })
            expect(f.delivery.recover).not.toHaveBeenCalled()
        }
    )

    it('recovers invalid payloads before enqueueing any update', async () => {
        const f = fixture()
        f.notifications.start()
        await f.emit(GameNotificationAction.AddActions, { game: f.game, actions: [{}] })
        await f.emit(GameNotificationAction.ReplaceProjectedActions, {
            ...f.projected,
            actionReplay: { startIndex: -1, actions: [] },
            checksum: 123
        })
        await f.emit(GameNotificationAction.UndoAction, { game: f.game, canonicalReplay: {} })
        expect(f.delivery.recover).toHaveBeenCalledTimes(3)
        expect(f.delivery.enqueue).not.toHaveBeenCalled()
    })

    it('recovers a failed Host View refresh', async () => {
        const f = fixture()
        f.notifications.start()
        f.view.host = true
        f.delivery.refreshHost.mockRejectedValueOnce(Error('Refresh failed'))
        await f.emit(GameNotificationAction.AddActions, { game: f.game })
        expect(f.delivery.recover).toHaveBeenCalledOnce()
    })

    it('reports deletion and stops delivery even while retaining Host View', async () => {
        const f = fixture()
        f.notifications.start()
        f.view.host = true
        await f.emit(GameNotificationAction.Delete, { game: f.game })
        await f.emit(GameNotificationAction.AddProjectedActions, f.projected)
        expect(f.delivery.onDeleted).toHaveBeenCalledOnce()
        expect(f.unsubscribe).toHaveBeenCalledExactlyOnceWith(f.game.id)
        expect(f.delivery.enqueue).not.toHaveBeenCalled()
        expect(f.delivery.refreshHost).not.toHaveBeenCalled()
    })
})
