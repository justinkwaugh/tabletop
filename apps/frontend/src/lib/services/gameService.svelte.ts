import {
    GameSession,
    validateLocalGameState,
    type GameService as GameServiceInterface,
    TabletopApi,
    type GetGameOptions,
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
    initializeContinuationGame,
    assertExists,
    GameForkError,
    GameStorage,
    GameCategory,
    PlayerStatus
} from '@tabletop/common'
import * as Value from 'typebox/value'
import { SvelteMap } from 'svelte/reactivity'
import { NotificationService } from './notificationService.svelte'
import { compareGameInvitations } from '$lib/utils/gameInvitation'

import type { LibraryService } from './libraryService.svelte'

export class GameService implements GameServiceInterface {
    get supportsReproductionSeed(): boolean {
        return this.api.supportsReproductionSeed === true
    }
    private gamesById: Map<string, Game> = new SvelteMap()
    private localGamesById: Map<string, Game> = new SvelteMap()

    localGameStore: GameStore

    loading = $state(false)
    private loadingPromise: Promise<void> | null = null

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
                const myBPlayerId = b.players.find(
                    (player) => player.userId === sessionUser?.id
                )?.id
                const myAPlayerId = a.players.find(
                    (player) => player.userId === sessionUser?.id
                )?.id
                const isMyBTurn = myBPlayerId ? b.activePlayerIds?.includes(myBPlayerId) : false
                const isMyATurn = myAPlayerId ? a.activePlayerIds?.includes(myAPlayerId) : false
                const activityOrder =
                    (a.lastActionAt ?? a.createdAt).getTime() -
                    (b.lastActionAt ?? b.createdAt).getTime()
                return (
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

    async hasActiveGames() {
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
        await this.libraryService.whenReady()
        const sessionUser = this.authorizationService.getSessionUser()
        const [games, localGames] = await Promise.all([
            this.api.getMyGames('current'),
            sessionUser ? this.localGameStore.findGamesForUser(sessionUser) : []
        ])

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
    }

    // Should debounce this
    async loadOpenGames(titleId: string) {
        await this.libraryService.whenReady()
        const response = await this.api.getOpenGames(titleId)
        this.openGamesByTitleId.set(titleId, response)
    }

    async loadGame(
        id: string,
        options: GetGameOptions = {}
    ): Promise<{ game?: Game; actions: GameAction[] }> {
        await this.libraryService.whenReady()
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
        const { game, actions } = await this.api.getGame(id, options)
        if (game) {
            this.gamesById.set(game.id, game)
        }
        return { game, actions }
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

    async continueGame(game: Game): Promise<Game> {
        await this.libraryService.whenReady()
        let next: Game
        if (game.storage === GameStorage.Local) {
            const definition = this.libraryService.getTitle(game.typeId)
            assertExists(definition, 'Game Title was not found')
            const runtime = await definition.runtime()
            next = await this.localGameStore.continueGame(game.id, (source, state) => {
                const continuation = initializeContinuationGame(source, state, {
                    info: definition.info,
                    runtime
                })
                const { startedGame, initialState } = new GameEngine(runtime).startGame(
                    continuation,
                    { previousState: state }
                )
                startedGame.activePlayerIds = initialState.activePlayerIds
                return { game: startedGame, state: initialState }
            })
            this.localGamesById.set(game.id, { ...game, continuedToGameId: next.id })
            this.localGamesById.set(next.id, next)
        } else {
            next = await this.api.continueGame(game)
            this.gamesById.set(game.id, { ...game, continuedToGameId: next.id })
            this.gamesById.set(next.id, next)
        }
        return next
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
        const saved = await this.localGameStore.findGameById(gameData.id)
        assertExists(saved, 'Saved game was not found')
        this.localGamesById.set(saved.id, saved)
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
                this.upsertCachedGame(game)
            } else if (notification.action === GameNotificationAction.Delete) {
                this.removeFromPrivateCache(game.id)
                this.removeFromPublicCache(game.id)
            }
        } else if (isDiscontinuityEvent(event) && event.channel === NotificationChannel.User) {
            await this.loadGames()
        }
    }

    private isGameNotification(notification: Notification): notification is GameNotification {
        return notification.type === NotificationCategory.Game
    }
}
