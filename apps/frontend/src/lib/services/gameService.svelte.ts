import {
    GameSession,
    validateLocalGameState,
    type GameService as GameServiceInterface,
    TabletopApi,
    type GetGameOptions,
    type GameLoadResult,
    type AuthorizationService,
    type GameStore,
    type NotificationEvent,
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    IndexedDbGameStore
} from '@tabletop/frontend-components'
import {
    type GameCreationOptions,
    Game,
    type GameNotification,
    GameNotificationAction,
    GameStatus,
    Notification,
    NotificationCategory,
    GameAction,
    GameState,
    type HydratedGameState,
    GameEngine,
    createGameFork,
    GameForkError,
    GameStorage,
    GameCategory,
    PlayerStatus,
    type IsYourTurnNotification,
    UserNotificationAction
} from '@tabletop/common'
import * as Type from 'typebox'
import * as Value from 'typebox/value'
import { SvelteMap } from 'svelte/reactivity'
import { NotificationService } from './notificationService.svelte'
import { isUsersGameTurn } from '$lib/utils/dashboardGames'
import { compareGameInvitations } from '$lib/utils/gameInvitation'

import type { LibraryService } from './libraryService.svelte'
import { readStoredValue, removeStoredValue, writeStoredValue } from '$lib/utils/storedValue'

const StoredCurrentGames = Type.Object({ userId: Type.String(), games: Type.Array(Game) })

export class GameService implements GameServiceInterface {
    get supportsReproductionSeed(): boolean {
        return this.api.supportsReproductionSeed === true
    }
    private gamesById: Map<string, Game> = new SvelteMap()
    private localGamesById: Map<string, Game> = new SvelteMap()

    localGameStore: GameStore

    loading = $state(false)
    private loadingPromise: Promise<void> | null = null
    private currentGamesFetched = false
    private static readonly storedCurrentGamesKey = 'currentGames'

    currentGameSession: GameSession<GameState, HydratedGameState> | undefined = $state(undefined)

    activeGames: Game[] = $derived.by(() => {
        const sessionUser = this.authorizationService.getSessionUser()
        if (!sessionUser) {
            return []
        }

        return [...this.gamesById.values(), ...this.localGamesById.values()]
            .filter(
                (game) =>
                    game.status === GameStatus.Started && game.category !== GameCategory.Exploration
            )
            .toSorted((a, b) => {
                const isMyBTurn = isUsersGameTurn(b, sessionUser.id)
                const isMyATurn = isUsersGameTurn(a, sessionUser.id)
                const activityOrder =
                    (a.lastActionAt ?? a.createdAt).getTime() -
                    (b.lastActionAt ?? b.createdAt).getTime()
                return (
                    Number(a.hotseat) - Number(b.hotseat) ||
                    (isMyBTurn ? 1 : 0) - (isMyATurn ? 1 : 0) ||
                    (isMyATurn ? activityOrder : -activityOrder)
                )
            })
    })

    waitingGames: Game[] = $derived(
        Array.from(this.gamesById.values())
            .filter(
                (game) =>
                    (game.status === GameStatus.WaitingForPlayers ||
                        game.status === GameStatus.WaitingToStart) &&
                    game.category !== GameCategory.Exploration
            )
            .toSorted(
                (a, b) =>
                    compareGameInvitations(a, b, this.authorizationService.getSessionUser()?.id) ||
                    b.createdAt.getTime() - a.createdAt.getTime()
            )
    )

    finishedGames: Game[] = $derived(
        Array.from(this.gamesById.values())
            .filter(
                (game) =>
                    game.status === GameStatus.Finished &&
                    game.category !== GameCategory.Exploration
            )
            .toSorted(
                (a, b) =>
                    (b.finishedAt ?? b.lastActionAt ?? b.createdAt).getTime() -
                    (a.finishedAt ?? a.lastActionAt ?? a.createdAt).getTime()
            )
            .slice(0, 20)
    )

    openGamesByTitleId: Map<string, Game[]> = new SvelteMap()

    constructor(
        private readonly libraryService: LibraryService,
        private readonly authorizationService: AuthorizationService,
        private readonly notificationService: NotificationService,
        private readonly api: TabletopApi
    ) {
        notificationService.addListener(this.NotificationListener)
        this.localGameStore = new IndexedDbGameStore()
    }

    isSessionUsersTurn(gameId: string): boolean {
        const game = this.gamesById.get(gameId)
        return (
            game !== undefined &&
            !game.hotseat &&
            isUsersGameTurn(game, this.authorizationService.getSessionUser()?.id)
        )
    }

    async hasActiveGames() {
        if (this.readStoredCurrentGames()?.length) {
            return true
        }
        return this.api.hasActiveGames()
    }

    async loadGames() {
        if (!this.loadingPromise) {
            this.loading = true
            this.loadingPromise = this.loadCurrentGames().finally(() => {
                this.loading = false
                this.loadingPromise = null
            })
        }
        return this.loadingPromise
    }

    private async loadCurrentGames() {
        if (!this.currentGamesFetched) {
            this.applyStoredCurrentGames()
        }
        const sessionUser = this.authorizationService.getSessionUser()
        const [games, localGames] = await Promise.all([
            this.api.getMyGames('current'),
            sessionUser ? this.localGameStore.findGamesForUser(sessionUser) : []
        ])
        if (this.authorizationService.getSessionUser()?.id !== sessionUser?.id) {
            return
        }

        const ids = new Set(games.map((game) => game.id))
        games.forEach((game) => {
            this.gamesById.set(game.id, game)
        })
        this.gamesById.forEach((game, id) => {
            if (!ids.has(id)) {
                this.gamesById.delete(id)
            }
        })
        this.localGamesById.clear()
        localGames.forEach((game) => {
            this.localGamesById.set(game.id, game)
        })
        this.currentGamesFetched = true
        if (sessionUser) {
            writeStoredValue(GameService.storedCurrentGamesKey, { userId: sessionUser.id, games })
        }
    }

    private applyStoredCurrentGames() {
        this.readStoredCurrentGames()?.forEach((game) => {
            if (!this.gamesById.has(game.id)) {
                this.gamesById.set(game.id, game)
            }
        })
    }

    private readStoredCurrentGames(): Game[] | undefined {
        const sessionUser = this.authorizationService.getSessionUser()
        const stored = readStoredValue(GameService.storedCurrentGamesKey, StoredCurrentGames)
        return sessionUser && stored?.userId === sessionUser.id ? stored.games : undefined
    }

    // Should debounce this
    async loadOpenGames(titleId: string) {
        const response = await this.api.getOpenGames(titleId)
        this.openGamesByTitleId.set(titleId, response)
    }

    async loadGame(id: string, options: GetGameOptions = {}): Promise<GameLoadResult> {
        // First check local hotseat games
        if (!this.localGamesById.has(id)) {
            const localGame = await this.localGameStore.findGameById(id)
            if (localGame) {
                this.localGamesById.set(localGame.id, localGame)
            }
        }

        const localGame = this.localGamesById.get(id)
        if (localGame) {
            const data = await this.localGameStore.loadGameData(id)
            if (data.game?.state)
                await validateLocalGameState(this.libraryService, data.game, data.game.state)
            return data
        }

        // Check remote games
        const { game, actions, historyComplete } = await this.api.getGame(id, options)
        if (game) {
            this.gamesById.set(game.id, game)
        }
        return { game, actions, historyComplete }
    }

    getExplorations(gameId: string): Game[] {
        return Array.from(this.localGamesById.values()).filter(
            (game) => game.parentId === gameId && game.category === GameCategory.Exploration
        )
    }

    async createGame(game: Partial<Game>, options?: GameCreationOptions): Promise<Game> {
        await this.libraryService.whenReady()
        let newGame: Game
        if (!game.typeId) {
            throw new Error('Game typeId is required to create a game')
        }

        if (game.storage === GameStorage.Local) {
            const definition = this.libraryService.getTitle(game.typeId)
            if (!definition) {
                throw new Error(`Game definition not found for typeId ${game.typeId}`)
            }

            for (const player of game.players ?? []) {
                player.userId = game.ownerId
            }

            const runtime = await definition.runtime()
            const gameDefinition = { info: definition.info, runtime }
            const initializedGame = runtime.initializer.initializeGame(game, gameDefinition)

            const engine = new GameEngine(runtime)
            const { startedGame, initialState } = engine.startGame(
                initializedGame,
                options?.masterSeed
            )

            startedGame.activePlayerIds = initialState.activePlayerIds

            newGame = await this.localGameStore.createGame(startedGame, initialState)
            this.localGamesById.set(newGame.id, newGame)
        } else {
            newGame = await this.api.createGame(game, options)
            this.gamesById.set(newGame.id, newGame)

            if (newGame.isPublic && newGame.status === GameStatus.WaitingForPlayers) {
                const titleGames = this.openGamesByTitleId.get(newGame.typeId) || []
                titleGames.push(newGame)
                this.openGamesByTitleId.set(newGame.typeId, titleGames)
            }
        }

        return newGame
    }

    async forkGame(game: Partial<Game>, actionIndex: number, name: string): Promise<Game> {
        if (game.storage === GameStorage.Local) {
            if (!game.id) {
                throw new Error('Game ID is required to fork a local game')
            }

            const { game: actualGame, actions } = await this.loadGame(game.id)
            if (!actualGame) {
                throw new Error(`Local game not found for id ${game.id}`)
            }

            const definition = this.libraryService.getTitle(actualGame.typeId)
            if (!definition) {
                throw new Error(`Game definition not found for typeId ${actualGame.typeId}`)
            }

            if (!actualGame.state) throw new GameForkError(actualGame.id, actionIndex)
            const fork = createGameFork({
                game: actualGame,
                state: actualGame.state,
                actions,
                actionIndex,
                runtime: await definition.runtime(),
                name
            })
            await this.saveGameLocally(fork)
            return fork.game
        } else {
            const newGame = await this.api.forkGame(game, actionIndex, name)
            this.gamesById.set(newGame.id, newGame)
            return newGame
        }
    }

    async updateGame(game: Partial<Game>): Promise<Game> {
        const updatedGame = await this.api.updateGame(game)
        this.upsertCachedGame(updatedGame)
        return updatedGame
    }

    async saveGameLocally({
        game,
        state,
        actions
    }: {
        game: Game
        state: GameState
        actions: GameAction[]
    }) {
        const gameData = structuredClone(game)
        const stateData = structuredClone(state)
        const actionsData = actions.map((action) => structuredClone(action))

        gameData.activePlayerIds = stateData.activePlayerIds

        if (game.storage !== GameStorage.Local) {
            throw new Error('Can only save local games locally')
        }

        await validateLocalGameState(this.libraryService, gameData, stateData)
        await this.localGameStore.storeGameData({
            game: gameData,
            actions: actionsData,
            state: stateData
        })
        this.localGamesById.set(gameData.id, gameData)
    }

    async deleteGame(gameId: string): Promise<void> {
        if (this.localGamesById.has(gameId)) {
            await this.localGameStore.deleteGame(gameId)
        } else {
            await this.api.deleteGame(gameId)
        }
        this.removeFromPrivateCache(gameId)
        this.removeFromPublicCache(gameId)
    }

    async startGame(game: Game): Promise<Game> {
        const startedGame = await this.api.startGame(game)
        this.upsertCachedGame(startedGame)
        return startedGame
    }

    async joinGame(gameId: string): Promise<Game> {
        const game = await this.api.joinGame(gameId)
        this.upsertCachedGame(game)
        return game
    }

    async declineGame(gameId: string): Promise<Game> {
        const game = await this.api.declineGame(gameId)
        this.upsertCachedGame(game)
        return game
    }

    private upsertCachedGame(game: Game) {
        const myUserId = this.authorizationService.getSessionUser()?.id
        const mine = game.players.find(
            (player) =>
                player.userId === myUserId &&
                (player.status === PlayerStatus.Joined || player.status === PlayerStatus.Reserved)
        )

        if (!game.isPublic) {
            if (!mine) {
                this.removeFromPrivateCache(game.id)
            } else if (game.storage === GameStorage.Local) {
                this.localGamesById.set(game.id, game)
            } else {
                this.gamesById.set(game.id, game)
            }
        } else {
            if (!game.players.some((p) => p.status === PlayerStatus.Open)) {
                this.removeFromPublicCache(game.id)
            } else {
                const titleGames = (this.openGamesByTitleId.get(game.typeId) || []).filter(
                    (g) => g.id !== game.id
                )

                titleGames.push(game)
                this.openGamesByTitleId.set(game.typeId, titleGames)
            }

            if (!mine && game.ownerId !== myUserId) {
                this.removeFromPrivateCache(game.id)
            } else {
                this.gamesById.set(game.id, game)
            }
        }
    }

    private removeFromPrivateCache(gameId: string) {
        this.gamesById.delete(gameId)
        this.localGamesById.delete(gameId)
    }

    private removeFromPublicCache(gameId: string) {
        for (const [titleId, games] of this.openGamesByTitleId) {
            const hasGame = games.find((game) => game.id === gameId)
            if (!hasGame) {
                continue
            }
            this.openGamesByTitleId.set(
                titleId,
                games.filter((game) => game.id !== gameId)
            )
        }
    }

    async setGameState(game: Game, state: GameState): Promise<void> {
        if (game.storage === GameStorage.Local) {
            const gameData = await this.loadGame(game.id)
            if (!gameData.game) {
                throw new Error(`Local game not found for id ${game.id}`)
            }
            await this.saveGameLocally({
                game: gameData.game,
                state: structuredClone(state),
                actions: gameData.actions
            })
        } else {
            await this.api.setGameState(state)
        }
    }

    clear() {
        this.gamesById.clear()
        this.currentGamesFetched = false
        removeStoredValue(GameService.storedCurrentGamesKey)
    }

    private NotificationListener = async (event: NotificationEvent) => {
        if (isDataEvent(event)) {
            const notification = event.notification
            if (this.isTurnNotification(notification)) {
                await this.loadGames()
                return
            }
            if (!this.isGameNotification(notification)) {
                return
            }
            const game = Value.Convert(Game, notification.data.game) as Game
            if (
                notification.action === GameNotificationAction.Create ||
                notification.action === GameNotificationAction.Update
            ) {
                this.upsertCachedGame(game)
            } else if (notification.action === GameNotificationAction.Delete) {
                this.removeFromPrivateCache(game.id)
                this.removeFromPublicCache(game.id)
            }
        } else if (isDiscontinuityEvent(event) && event.channel === NotificationChannel.User) {
            await this.loadGames()
        }
    }

    private isTurnNotification(notification: Notification): notification is IsYourTurnNotification {
        return (
            notification.type === NotificationCategory.User &&
            notification.action === UserNotificationAction.IsYourTurn
        )
    }

    private isGameNotification(notification: Notification): notification is GameNotification {
        return notification.type === NotificationCategory.Game
    }
}
