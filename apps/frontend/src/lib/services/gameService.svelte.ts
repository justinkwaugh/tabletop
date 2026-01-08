import {
    GameSession,
    type GameService as GameServiceInterface,
    TabletopApi,
    type AuthorizationService,
    type GameStore,
    type NotificationEvent,
    isDataEvent,
    isDiscontinuityEvent,
    NotificationChannel,
    IndexedDbGameStore
} from '@tabletop/frontend-components'
import {
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
    GameStorage,
    GameCategory,
    RunMode,
    PlayerStatus
} from '@tabletop/common'
import { Value } from 'typebox/value'
import { SvelteMap } from 'svelte/reactivity'
import { NotificationService } from './notificationService.svelte'

import type { LibraryService } from './libraryService.js'
import { nanoid } from 'nanoid'

export class GameService implements GameServiceInterface {
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
                return (
                    (isMyBTurn ? 1 : 0) - (isMyATurn ? 1 : 0) ||
                    (b.lastActionAt ?? b.createdAt).getTime() -
                        (a.lastActionAt ?? a.createdAt).getTime()
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
            .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
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

    // Only allow a single async load at a time
    async loadGames() {
        await this.loadLocalGames()

        if (!this.loadingPromise) {
            this.loading = true
            this.loadingPromise = this.api.getMyGames().then((games) => {
                const ids = games.map((game) => game.id)
                games.forEach((game) => {
                    this.gamesById.set(game.id, game)
                })
                this.gamesById.forEach((game, id) => {
                    if (!ids.includes(id)) {
                        this.gamesById.delete(id)
                    }
                })
                this.loading = false
                this.loadingPromise = null
            })
        }
        return this.loadingPromise
    }

    async loadLocalGames() {
        const sessionUser = this.authorizationService.getSessionUser()
        if (!sessionUser) {
            console.log('No session user, clearing hotseat games')
            this.localGamesById.clear()
            return
        }

        const games = await this.localGameStore.findGamesForUser(sessionUser)
        games.forEach((game) => {
            this.localGamesById.set(game.id, game)
        })
    }

    // Should debounce this
    async loadOpenGames(titleId: string) {
        const response = await this.api.getOpenGames(titleId)
        this.openGamesByTitleId.set(titleId, response)
    }

    async loadGame(id: string): Promise<{ game?: Game; actions: GameAction[] }> {
        // First check local hotseat games
        if (!this.localGamesById.has(id)) {
            const localGame = await this.localGameStore.findGameById(id)
            if (localGame) {
                this.localGamesById.set(localGame.id, localGame)
            }
        }

        const localGame = this.localGamesById.get(id)
        if (localGame) {
            return await this.localGameStore.loadGameData(id)
        }

        // Check remote games
        const { game, actions } = await this.api.getGame(id)
        if (game) {
            this.gamesById.set(game.id, game)
        }
        return { game, actions }
    }

    getExplorations(gameId: string): Game[] {
        return Array.from(this.localGamesById.values()).filter((game) => game.parentId === gameId)
    }

    async createGame(game: Partial<Game>): Promise<Game> {
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

            const initializedGame = definition.initializer.initializeGame(game)

            const engine = new GameEngine(definition)
            const { startedGame, initialState } = engine.startGame(initializedGame)

            startedGame.activePlayerIds = initialState.activePlayerIds

            newGame = await this.localGameStore.createGame(startedGame, initialState)
            this.localGamesById.set(newGame.id, newGame)
        } else {
            newGame = await this.api.createGame(game)
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

            const forkedGame = structuredClone(actualGame)

            // Reset fields
            forkedGame.id = nanoid()
            if (name && name.trim().length > 0) {
                forkedGame.name = name
            }
            forkedGame.startedAt = undefined
            forkedGame.status = GameStatus.Started
            delete forkedGame.result
            delete forkedGame.finishedAt
            forkedGame.winningPlayerIds = []

            // Generate initial state
            const engine = new GameEngine(definition)
            const { startedGame, initialState } = engine.startGame(forkedGame)

            // Copy the entire action history up to the specified index
            const actionSubset = actions
                .slice(0, actionIndex + 1)
                .map((action) => structuredClone(action))

            let state = initialState
            const updatedActions = []
            // Run the game to the desired index
            for (const action of actionSubset) {
                // Copy and adjust
                action.id = nanoid()
                action.gameId = forkedGame.id
                action.undoPatch = undefined

                // Apply each action to the forked game state
                const { processedActions, updatedState } = engine.run(
                    action,
                    state,
                    startedGame,
                    RunMode.Single
                )
                state = updatedState
                updatedActions.push(...processedActions)
            }

            // Update some relevant fields on the game
            startedGame.activePlayerIds = state.activePlayerIds || []
            const lastAction = updatedActions.at(-1)
            if (lastAction) {
                startedGame.lastActionAt = lastAction.createdAt
                startedGame.lastActionPlayerId = lastAction.playerId
            } else {
                startedGame.lastActionAt = undefined
                startedGame.lastActionPlayerId = undefined
            }

            await this.saveGameLocally({
                game: startedGame,
                state,
                actions: updatedActions
            })
            this.localGamesById.set(startedGame.id, startedGame)

            return startedGame
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
            console.log('game notification received', notification)
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
