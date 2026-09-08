import {
    CanonicalActionReplayManifest,
    Game,
    GameAction,
    GameNotificationAction,
    NotificationCategory,
    ProcessedActionReplay,
    type GameNotification,
    type Notification,
    type Visibility
} from '@tabletop/common'
import * as Value from 'typebox/value'
import {
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    type NotificationEvent,
    type NotificationService
} from '../services/notificationService.js'
import { ServerActionHandling, type ReconciliationUpdate } from './gameReconciliation.js'

interface NotificationDelivery {
    usesProjection: boolean
    acceptsPerspective(perspective: Visibility.Perspective): boolean
    hasHostContext(): boolean
    refreshHost(): Promise<void>
    enqueue(update: ReconciliationUpdate): Promise<void>
    recover(): Promise<void>
    onDeleted(): void
}

export class GameNotifications {
    private listening = false

    constructor(
        private readonly game: Pick<Game, 'id' | 'hotseat'>,
        private readonly service: NotificationService,
        private readonly delivery: NotificationDelivery
    ) {}

    start(): void {
        if (this.listening || this.game.hotseat) return
        this.listening = true
        this.service.addListener(this.onEvent)
        this.service.listenToGame(this.game.id)
    }

    stop(): void {
        if (!this.listening) return
        this.listening = false
        this.service.removeListener(this.onEvent)
        this.service.stopListeningToGame(this.game.id)
    }

    private onEvent = async (event: NotificationEvent): Promise<void> => {
        if (!this.listening) return
        if (isDataEvent(event)) {
            try {
                await this.receive(event.notification)
            } catch (error) {
                console.error('Error handling notification:', error)
                await this.delivery.recover()
            }
        } else if (
            isDiscontinuityEvent(event) &&
            (event.channel === NotificationChannel.GameInstance ||
                (event.channel === NotificationChannel.User && this.delivery.usesProjection))
        ) {
            await this.delivery.enqueue({ kind: 'synchronize' })
        }
    }

    private async receive(notification: Notification): Promise<void> {
        if (
            !this.isHandledNotification(notification) ||
            notification.data.game.id !== this.game.id
        ) {
            return
        }
        if (
            notification.action !== GameNotificationAction.Delete &&
            this.delivery.hasHostContext()
        ) {
            await this.delivery.refreshHost()
            return
        }
        switch (notification.action) {
            case GameNotificationAction.AddActions:
                await this.enqueueActions(
                    notification.data.game,
                    notification.data.actions,
                    ServerActionHandling.Execute
                )
                break
            case GameNotificationAction.AddProjectedActions:
                if (this.delivery.acceptsPerspective(notification.data.perspective)) {
                    await this.enqueueActions(
                        notification.data.game,
                        notification.data.actions,
                        ServerActionHandling.ApplyProcessed
                    )
                }
                break
            case GameNotificationAction.ReplaceProjectedActions: {
                if (!this.delivery.acceptsPerspective(notification.data.perspective)) return
                const replay = Value.Convert(ProcessedActionReplay, notification.data.actionReplay)
                Value.Assert(ProcessedActionReplay, replay)
                await this.delivery.enqueue({
                    kind: 'replacement',
                    replay,
                    checksum: notification.data.checksum,
                    game: this.convertGame(notification.data.game),
                    perspective: notification.data.perspective
                })
                break
            }
            case GameNotificationAction.UndoAction: {
                const manifest = Value.Convert(
                    CanonicalActionReplayManifest,
                    notification.data.canonicalReplay
                )
                Value.Assert(CanonicalActionReplayManifest, manifest)
                await this.delivery.enqueue({
                    kind: 'manifest',
                    manifest,
                    redoneActions: this.convertActions(notification.data.redoneActions),
                    checksum: notification.data.checksum,
                    game: this.convertGame(notification.data.game)
                })
                break
            }
            case GameNotificationAction.Delete:
                this.delivery.onDeleted()
                this.stop()
                break
        }
    }

    private async enqueueActions(
        game: Game,
        actions: GameAction[],
        handling: ServerActionHandling
    ): Promise<void> {
        await this.delivery.enqueue({
            kind: 'actions',
            actions: this.convertActions(actions),
            handling,
            game: this.convertGame(game)
        })
    }

    private convertActions(actions: GameAction[]): GameAction[] {
        return actions.map((action) => {
            const converted = Value.Convert(GameAction, action)
            Value.Assert(GameAction, converted)
            return converted
        })
    }

    private convertGame(game: Game): Game {
        const converted = Value.Convert(Game, game)
        Value.Assert(Game, converted)
        return converted
    }

    private isHandledNotification(notification: Notification): notification is GameNotification {
        return (
            notification.type === NotificationCategory.Game &&
            (notification.action === GameNotificationAction.AddActions ||
                notification.action === GameNotificationAction.AddProjectedActions ||
                notification.action === GameNotificationAction.ReplaceProjectedActions ||
                notification.action === GameNotificationAction.UndoAction ||
                notification.action === GameNotificationAction.Delete)
        )
    }
}
