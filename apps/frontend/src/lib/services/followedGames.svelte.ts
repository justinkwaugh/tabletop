import {
    APIError,
    type AuthorizationService,
    type NotificationEvent,
    NotificationChannel,
    TabletopApi,
    isDataEvent,
    isDiscontinuityEvent
} from '@tabletop/frontend-components'
import {
    Game,
    GameNotificationAction,
    type GameNotification,
    canFollowGame,
    gameUserIds,
    isGameNotification,
    omitGameState
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { SvelteMap } from 'svelte/reactivity'
import type { NotificationService } from './notificationService.svelte'
import { compareFollowedGames } from '$lib/utils/dashboardGames'
import { isNewerGame } from '$lib/utils/gameUpdates'
import { m } from '$lib/paraglide/messages'

export function followFailureMessage(error: unknown): string {
    return error instanceof APIError ? error.message : m.follow_update_failed()
}

export class FollowedGames {
    private readonly gamesById: Map<string, Game> = new SvelteMap()
    // A reload leaves a game alone if it changed here after the reload started, or while a
    // follow or unfollow request for it is outstanding, since the server may not have it yet.
    private readonly changedAt = new Map<string, number>()
    // The change number of the latest follow or unfollow of each game. Only that one may roll back.
    private readonly intents = new Map<string, number>()
    // Requests for one game are sent one at a time so the server applies them in order.
    private readonly requests = new Map<string, Promise<void>>()
    private changes = 0
    private inFlight: { userId: string; promise: Promise<void> } | undefined

    loading = $state(false)
    loaded = $state(false)

    games: Game[] = $derived([...this.gamesById.values()].toSorted(compareFollowedGames))

    constructor(
        private readonly authorizationService: Pick<AuthorizationService, 'getSessionUser'>,
        notificationService: Pick<NotificationService, 'addListener'>,
        private readonly api: Pick<TabletopApi, 'getFollowedGames' | 'followGame' | 'unfollowGame'>
    ) {
        notificationService.addListener(this.onEvent)
    }

    isFollowing(gameId: string): boolean {
        return this.gamesById.has(gameId)
    }

    canToggle(game: Game): boolean {
        const userId = this.sessionUserId()
        return (
            this.loaded &&
            userId !== undefined &&
            (this.isFollowing(game.id) || canFollowGame(game, userId))
        )
    }

    async load(): Promise<void> {
        const userId = this.sessionUserId()
        if (userId === undefined) return
        if (this.inFlight?.userId !== userId) {
            const promise = this.fetch(userId).finally(() => {
                if (this.inFlight?.promise === promise) this.inFlight = undefined
            })
            this.inFlight = { userId, promise }
        }
        return this.inFlight.promise
    }

    async loadOnce(): Promise<void> {
        if (!this.loaded) await this.load()
    }

    async toggle(game: Game): Promise<void> {
        if (this.isFollowing(game.id)) await this.unfollow(game.id)
        else await this.follow(game)
    }

    // Shown as followed straight away, so updates that arrive before the request returns are kept.
    async follow(game: Game): Promise<void> {
        const intent = this.markIntent(game.id)
        this.keepLatest(omitGameState(game))
        await this.send(
            game.id,
            intent,
            () => this.api.followGame(game.id),
            () => {
                this.gamesById.delete(game.id)
            }
        )
    }

    async unfollow(gameId: string): Promise<void> {
        const held = this.gamesById.get(gameId)
        const intent = this.markIntent(gameId)
        this.gamesById.delete(gameId)
        await this.send(
            gameId,
            intent,
            () => this.api.unfollowGame(gameId),
            () => {
                if (held) this.keepLatest(held)
            }
        )
    }

    clear() {
        this.gamesById.clear()
        this.changedAt.clear()
        this.intents.clear()
        this.requests.clear()
        this.inFlight = undefined
        this.loaded = false
    }

    private async send(
        gameId: string,
        intent: number,
        request: () => Promise<void>,
        rollBack: () => void
    ): Promise<void> {
        const sent = (this.requests.get(gameId) ?? Promise.resolve()).then(request)
        const settled = sent.then(
            () => undefined,
            () => undefined
        )
        this.requests.set(gameId, settled)
        try {
            await sent
        } catch (error) {
            if (this.intents.get(gameId) === intent) rollBack()
            throw error
        } finally {
            if (this.requests.get(gameId) === settled) this.requests.delete(gameId)
            this.markChanged(gameId)
        }
    }

    private async fetch(userId: string): Promise<void> {
        const startedAt = this.changes
        this.loading = true
        try {
            const games = await this.api.getFollowedGames()
            if (this.sessionUserId() !== userId) return
            const listed = new Set(games.map((game) => game.id))
            for (const id of [...this.gamesById.keys()]) {
                if (!listed.has(id) && !this.changedLocally(id, startedAt))
                    this.gamesById.delete(id)
            }
            for (const game of games) {
                if (!this.changedLocally(game.id, startedAt)) this.keepLatest(game)
            }
            this.loaded = true
        } finally {
            this.loading = false
        }
    }

    private onEvent = async (event: NotificationEvent) => {
        if (isDataEvent(event)) {
            if (isGameNotification(event.notification)) this.receive(event.notification)
        } else if (
            isDiscontinuityEvent(event) &&
            event.channel === NotificationChannel.User &&
            this.loaded
        ) {
            await this.load()
        }
    }

    private receive(notification: GameNotification) {
        if (!this.gamesById.has(notification.data.game.id)) return
        const game = Value.Convert(Game, notification.data.game)
        Value.Assert(Game, game)
        if (notification.action === GameNotificationAction.Delete || this.isSeated(game)) {
            this.markChanged(game.id)
            this.gamesById.delete(game.id)
        } else if (
            notification.action === GameNotificationAction.Create ||
            notification.action === GameNotificationAction.Update
        ) {
            this.keepLatest(game)
        }
    }

    private isSeated(game: Game): boolean {
        const userId = this.sessionUserId()
        return userId !== undefined && gameUserIds(game).includes(userId)
    }

    private sessionUserId(): string | undefined {
        return this.authorizationService.getSessionUser()?.id
    }

    private markChanged(gameId: string): number {
        this.changedAt.set(gameId, ++this.changes)
        return this.changes
    }

    private markIntent(gameId: string): number {
        const change = this.markChanged(gameId)
        this.intents.set(gameId, change)
        return change
    }

    private changedLocally(gameId: string, since: number): boolean {
        return this.requests.has(gameId) || (this.changedAt.get(gameId) ?? 0) > since
    }

    private keepLatest(game: Game) {
        const held = this.gamesById.get(game.id)
        if (!held || !isNewerGame(held, game)) this.gamesById.set(game.id, game)
    }
}
