import { Game, GameAction, GameState, type HydratedGameState } from '@tabletop/common'
import type { GameSession } from '$lib/model/gameSession.svelte.js'

export type GameService = {
    loading: boolean
    activeGames: Game[]
    waitingGames: Game[]
    finishedGames: Game[]
    currentGameSession?: GameSession<GameState, HydratedGameState>

    hasActiveGames(): Promise<boolean>
    loadGames(): Promise<void>
    loadGame(gameId: string): Promise<{ game?: Game; actions: GameAction[] }>

    createGame(game: Partial<Game>): Promise<Game>
    forkGame(game: Partial<Game>, actionIndex: number, name: string): Promise<Game>
    updateGame(game: Partial<Game>): Promise<Game>

    // This feels too specific for this service
    saveGameLocally({
        game,
        state,
        actions
    }: {
        game: Game
        state: GameState
        actions: GameAction[]
    }): Promise<void>

    deleteGame(gameId: string): Promise<void>
    startGame(game: Game): Promise<Game>
    joinGame(gameId: string): Promise<Game>
    declineGame(gameId: string): Promise<Game>
    clear(): void
    getExplorations(gameId: string): Game[]
    setGameState(game: Game, state: GameState): Promise<void>
}
