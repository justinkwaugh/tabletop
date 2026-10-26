import { validateLocalGameState } from '$lib/utils/validateLocalGameState.js'
import {
    type GameCreationOptions,
    Game,
    GameStatus,
    GameAction,
    GameState,
    type HydratedGameState,
    GameEngine,
    createGameFork,
    GameForkError,
    GameStorage,
    GameCategory,
    assertExists,
    createCallGameAction,
    isTwoPlayerGame,
    requiredCallApprovals,
    type ScenarioData
} from '@tabletop/common'
import { SvelteMap } from 'svelte/reactivity'
import type { GameService } from '$lib/services/gameService.js'
import type { GameStore } from '$lib/persistence/gameStore.js'
import type { GameSession } from '$lib/model/gameSession.svelte.js'
import { IndexedDbGameStore } from '$lib/persistence/indexedDbGameStore.js'
import type { AuthorizationService } from '$lib/services/authorizationService.js'
import type { LibraryService } from '$lib/services/libraryService.js'

export class HarnessGameService implements GameService {
    readonly developerHarness = true
    readonly supportsReproductionSeed = true
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

    async loadOpenGames(_titleId: string) {
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
        const data = await this.localGameStore.loadGameData(id)
        if (data.game?.state)
            await validateLocalGameState(this.libraryService, data.game, data.game.state)
        return data
    }

    getExplorations(gameId: string): Game[] {
        return Array.from(this.gamesById.values()).filter(
            (game) => game.parentId === gameId && game.category === GameCategory.Exploration
        )
    }

    async createGame(game: Partial<Game>, options?: GameCreationOptions): Promise<Game> {
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
        const { startedGame, initialState } = engine.startGame(initializedGame, options?.masterSeed)

        startedGame.activePlayerIds = initialState.activePlayerIds

        const newGame = await this.localGameStore.createGame(startedGame, initialState)
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

        const fork = await this.forkOf(game.id, actionIndex, name)
        await this.saveGameLocally(fork)
        return fork.game
    }

    /** The game as it stands, with every action behind it, ready to be saved as a scenario file. */
    async scenarioOf(gameId: string): Promise<ScenarioData> {
        return this.forkOf(gameId, 'latest')
    }

    async calledCopy(gameId: string, declaredWinnerId?: string): Promise<ScenarioData> {
        const { game, state, actions } = await this.scenarioOf(gameId)
        const players = game.players
        const initiator = isTwoPlayerGame(players)
            ? players.find((player) => player.id !== declaredWinnerId)
            : players[0]
        assertExists(initiator, 'A concession needs a player who does not win')
        const approvers = [initiator, ...players.filter((player) => player !== initiator)]
        const action = createCallGameAction({
            gameId: game.id,
            ballot: {
                initiatorPlayerId: initiator.id,
                declaredWinnerId,
                approvingPlayerIds: approvers
                    .slice(0, requiredCallApprovals(players))
                    .map((player) => player.id),
                decliningPlayerIds: []
            },
            players
        })
        const definition = this.libraryService.getTitle(game.typeId)
        assertExists(definition, `Game definition not found for typeId ${game.typeId}`)
        const engine = new GameEngine(await definition.runtime())
        const { processedActions, updatedState } = engine.executeCanonicalAction({
            action,
            state,
            game
        })
        return {
            game: {
                ...game,
                call: action.call,
                status: GameStatus.Finished,
                finishedAt: new Date(),
                result: updatedState.result,
                winningPlayerIds: updatedState.winningPlayerIds
            },
            state: updatedState,
            actions: [...actions, ...processedActions]
        }
    }

    private async forkOf(gameId: string, at: number | 'latest', name?: string) {
        const { game: actualGame, actions } = await this.loadGame(gameId)
        const actionIndex = at === 'latest' ? actions.length - 1 : at
        if (!actualGame) {
            throw new Error(`Local game not found for id ${gameId}`)
        }

        const definition = this.libraryService.getTitle(actualGame.typeId)
        if (!definition) {
            throw new Error(`Game definition not found for typeId ${actualGame.typeId}`)
        }

        if (!actualGame.state) throw new GameForkError(actualGame.id, actionIndex)
        return createGameFork({
            game: actualGame,
            state: actualGame.state,
            actions,
            actionIndex,
            runtime: await definition.runtime(),
            name
        })
    }

    async updateGame(_game: Partial<Game>): Promise<Game> {
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

        await validateLocalGameState(this.libraryService, gameData, stateData)
        await this.localGameStore.storeGameData({
            game: gameData,
            actions: actionsData,
            state: stateData
        })
        this.gamesById.set(gameData.id, gameData)
    }

    /** Saves a scenario as a local game of the harness user, replacing the copy loaded before, so loading it again starts it over. */
    async loadScenario({ game, state, actions }: ScenarioData): Promise<Game> {
        const user = this.authorizationService.getSessionUser()
        assertExists(user, 'The harness has a session user')
        const owned: Game = {
            ...game,
            ownerId: user.id,
            storage: GameStorage.Local,
            hotseat: true,
            players: game.players.map((player) => ({ ...player, userId: user.id }))
        }
        await this.saveGameLocally({ game: owned, state, actions })
        return owned
    }

    async deleteGame(gameId: string): Promise<void> {
        if (this.gamesById.has(gameId)) {
            await this.localGameStore.deleteGame(gameId)
            this.gamesById.delete(gameId)
        }
    }

    async startGame(_game: Game): Promise<Game> {
        throw new Error('Not implemented in harness')
    }

    async joinGame(_gameId: string): Promise<Game> {
        throw new Error('Not implemented in harness')
    }

    async declineGame(_gameId: string): Promise<Game> {
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
