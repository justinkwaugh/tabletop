import {
    GameSession,
    TabletopApi,
    type AuthorizationService,
    type NotificationEvent,
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel
} from '@tabletop/frontend-components'
import {
    Game,
    type GameNotification,
    GameNotificationAction,
    GameStatus,
    Notification,
    NotificationCategory,
    GameAction
} from '@tabletop/common'
import { Value } from '@sinclair/typebox/value'
import { SvelteMap } from 'svelte/reactivity'
import { NotificationService } from './notificationService.svelte'

export class GameService {
    private gamesById: Map<string, Game> = new SvelteMap()

    private activeGames: Game[] = $derived(
        Array.from(this.gamesById.values()).filter((game) => game.status === GameStatus.Started)
    )
    private waitingGames: Game[] = $derived(
        Array.from(this.gamesById.values())
            .filter(
                (game) =>
                    game.status === GameStatus.WaitingForPlayers ||
                    game.status === GameStatus.WaitingToStart
            )
            .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    )
    private finishedGames: Game[] = $derived(
        Array.from(this.gamesById.values())
            .filter((game) => game.status === GameStatus.Finished)
            .toSorted(
                (a, b) =>
                    (b.finishedAt ?? b.lastActionAt ?? b.createdAt).getTime() -
                    (a.finishedAt ?? a.lastActionAt ?? a.createdAt).getTime()
            )
            .slice(0, 10)
    )
    private loading = $state(false)
    private loaded = false
    private loadingPromise: Promise<void> | null = null

    currentGameSession: GameSession | undefined = $state(undefined)

    constructor(
        private readonly authorizationService: AuthorizationService,
        private readonly notificationService: NotificationService,
        private readonly api: TabletopApi
    ) {
        notificationService.addListener(this.NotificationListener)
    }

    isLoading(): boolean {
        return this.loading
    }

    async loadGames() {
        if (this.loaded) {
            return
        }
        if (!this.loadingPromise) {
            this.loading = true
            this.loadingPromise = this.api.getMyGames().then((games) => {
                this.gamesById.clear()
                games.forEach((game) => {
                    this.gamesById.set(game.id, game)
                })
                this.loading = false
                this.loaded = true
                this.loadingPromise = null
            })
        }
        return this.loadingPromise
    }

    async loadGame(id: string): Promise<{ game: Game; actions: GameAction[] }> {
        const { game, actions } = await this.api.getGame(id)
        if (game) {
            this.gamesById.set(game.id, game)
        }
        return { game, actions }
    }

    async createGame(game: Partial<Game>): Promise<Game> {
        const newGame = await this.api.createGame(game)
        this.gamesById.set(newGame.id, newGame)
        return newGame
    }

    async updateGame(game: Partial<Game>): Promise<Game> {
        const updatedGame = await this.api.updateGame(game)
        this.gamesById.set(updatedGame.id, updatedGame)
        return updatedGame
    }

    async deleteGame(gameId: string): Promise<void> {
        await this.api.deleteGame(gameId)
        this.gamesById.delete(gameId)
    }

    async startGame(game: Game): Promise<Game> {
        const startedGame = await this.api.startGame(game)
        this.gamesById.set(startedGame.id, startedGame)
        return startedGame
    }

    async joinGame(gameId: string): Promise<Game> {
        const game = await this.api.joinGame(gameId)
        this.gamesById.set(game.id, game)
        return game
    }

    async declineGame(gameId: string): Promise<Game> {
        const game = await this.api.declineGame(gameId)
        this.gamesById.set(game.id, game)
        return game
    }

    getActiveGames(): Game[] {
        const sessionUser = this.authorizationService.getSessionUser()

        return this.activeGames.toSorted((a, b) => {
            const myBPlayerId = b.players.find((player) => player.userId === sessionUser?.id)?.id
            const myAPlayerId = a.players.find((player) => player.userId === sessionUser?.id)?.id
            const isMyBTurn = myBPlayerId ? b.activePlayerIds?.includes(myBPlayerId) : false
            const isMyATurn = myAPlayerId ? a.activePlayerIds?.includes(myAPlayerId) : false
            return (
                (isMyBTurn ? 1 : 0) - (isMyATurn ? 1 : 0) ||
                (b.lastActionAt ?? b.createdAt).getTime() -
                    (a.lastActionAt ?? a.createdAt).getTime()
            )
        })
    }

    getWaitingGames(): Game[] {
        this.waitingGames.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        return this.waitingGames
    }

    getFinishedGames(): Game[] {
        this.finishedGames.sort(
            (a, b) =>
                (b.finishedAt?.getTime() ?? new Date().getTime()) -
                (a.finishedAt?.getTime() ?? new Date().getTime())
        )
        return this.finishedGames
    }

    clear() {
        this.gamesById.clear()
        this.loaded = false
    }

    private NotificationListener = async (event: NotificationEvent) => {
        if (isDataEvent(event)) {
            const notification = event.notification
            if (!this.isGameNotification(notification)) {
                return
            }

            const game = Value.Convert(Game, notification.data.game) as Game
            if (
                notification.action === GameNotificationAction.Create ||
                notification.action === GameNotificationAction.Update
            ) {
                this.gamesById.set(game.id, game)
            } else if (notification.action === GameNotificationAction.Delete) {
                this.gamesById.delete(game.id)
            }
        } else if (isDiscontinuityEvent(event) && event.channel === NotificationChannel.User) {
            this.loaded = false
            await this.loadGames()
        }
    }

    private isGameNotification(notification: Notification): notification is GameNotification {
        return notification.type === NotificationCategory.Game
    }
}
