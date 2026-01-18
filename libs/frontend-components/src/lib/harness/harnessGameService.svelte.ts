import {
    Game,
    GameStatus,
    GameAction,
    GameState,
    type HydratedGameState,
    GameEngine,
    GameStorage,
    GameCategory,
    RunMode,
    assertExists
} from '@tabletop/common'
import { SvelteMap } from 'svelte/reactivity'
import { nanoid } from 'nanoid'
import type { GameService } from '$lib/services/gameService.js'
import type { GameStore } from '$lib/persistence/gameStore.js'
import type { GameSession } from '$lib/model/gameSession.svelte.js'
import { IndexedDbGameStore } from '$lib/persistence/indexedDbGameStore.js'
import type { AuthorizationService } from '$lib/services/authorizationService.js'
import type { LibraryService } from '$lib/services/libraryService.js'

export class HarnessGameService implements GameService {
    private gamesById: Map<string, Game> = new SvelteMap()
    private localGameStore: GameStore

    loading = $state(false)
    currentGameSession: GameSession<GameState, HydratedGameState> | undefined = $state(undefined)

    activeGames: Game[] = $derived.by(() => {
        return [...this.gamesById.values()]
            .filter(
                (game) =>
                    game.status === GameStatus.Started && game.category !== GameCategory.Exploration
            )
            .toSorted((a, b) => {
                return (
                    (b.lastActionAt ?? b.createdAt).getTime() -
                    (a.lastActionAt ?? a.createdAt).getTime()
                )
            })
    })

    waitingGames: Game[] = []
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
    openGamesByTitleId: Map<string, Game[]> = new Map()

    constructor(
        private readonly libraryService: LibraryService,
        private readonly authorizationService: AuthorizationService
    ) {
        this.localGameStore = new IndexedDbGameStore()
    }

    async hasActiveGames() {
        return false
    }

    async loadGames() {
        await this.loadLocalGames()
    }

    async loadOpenGames(titleId: string) {
        return
    }

    async loadLocalGames() {
        const user = this.authorizationService.getSessionUser()
        if (!user) {
            return
        }
        const definition = this.libraryService.getTitles(user)[0]

        const games = await this.localGameStore.findGamesForUser(user)

        games
            .filter((game) => game.typeId === definition.info.id)
            .forEach((game) => {
                this.gamesById.set(game.id, game)
            })
    }

    async loadGame(id: string): Promise<{ game?: Game; actions: GameAction[] }> {
        // First check local hotseat games
        if (!this.gamesById.has(id)) {
            const localGame = await this.localGameStore.findGameById(id)
            if (localGame) {
                this.gamesById.set(localGame.id, localGame)
            }
        }
        return await this.localGameStore.loadGameData(id)
    }

    getExplorations(gameId: string): Game[] {
        return Array.from(this.gamesById.values()).filter((game) => game.parentId === gameId)
    }

    async createGame(game: Partial<Game>): Promise<Game> {
        let newGame: Game
        if (!game.typeId) {
            throw new Error('Game typeId is required to create a game')
        }

        if (game.storage !== GameStorage.Local) {
            throw new Error('Only local games can be created in the harness')
        }

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
        const { startedGame, initialState } = engine.startGame(initializedGame)

        startedGame.activePlayerIds = initialState.activePlayerIds

        newGame = await this.localGameStore.createGame(startedGame, initialState)
        this.gamesById.set(newGame.id, newGame)

        return newGame
    }

    async forkGame(game: Partial<Game>, actionIndex: number, name: string): Promise<Game> {
        if (game.storage !== GameStorage.Local) {
            throw new Error('Only local games can be forked in the harness')
        }

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
        const runtime = await definition.runtime()
        const engine = new GameEngine(runtime)
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
        this.gamesById.set(startedGame.id, startedGame)

        return startedGame
    }

    async updateGame(game: Partial<Game>): Promise<Game> {
        throw new Error('Not implemented in harness')
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
        this.gamesById.set(gameData.id, gameData)
    }

    async deleteGame(gameId: string): Promise<void> {
        if (this.gamesById.has(gameId)) {
            await this.localGameStore.deleteGame(gameId)
            this.gamesById.delete(gameId)
        }
    }

    async startGame(game: Game): Promise<Game> {
        throw new Error('Not implemented in harness')
    }

    async joinGame(gameId: string): Promise<Game> {
        throw new Error('Not implemented in harness')
    }

    async declineGame(gameId: string): Promise<Game> {
        throw new Error('Not implemented in harness')
    }

    async setGameState(game: Game, state: GameState): Promise<void> {
        if (game.storage !== GameStorage.Local) {
            throw new Error('Can only set state for local games in the harness')
        }
        const gameData = await this.loadGame(game.id)
        if (!gameData.game) {
            throw new Error(`Local game not found for id ${game.id}`)
        }
        await this.saveGameLocally({
            game: gameData.game,
            state: structuredClone(state),
            actions: gameData.actions
        })
    }

    clear() {
        this.gamesById.clear()
    }
}
