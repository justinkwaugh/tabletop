import { Game, GameAction, GameState } from '@tabletop/common'

export type GameService = {
    loadGames(): Promise<void>
    loadGame(gameId: string): Promise<{ game?: Game; actions: GameAction[] }>

    createGame(game: Partial<Game>): Promise<Game>
    forkGame(game: Partial<Game>, actionIndex: number): Promise<Game>
    updateGame(game: Partial<Game>): Promise<Game>
    addActionsToLocalGame({
        game,
        actions,
        state
    }: {
        game: Game
        actions: GameAction[]
        state: GameState
    }): Promise<void>
    undoActionsFromLocalGame({
        game,
        undoneActions,
        redoneActions,
        state
    }: {
        game: Game
        undoneActions: GameAction[]
        redoneActions: GameAction[]
        state: GameState
    }): Promise<void>
    deleteGame(gameId: string): Promise<void>
    startGame(game: Game): Promise<Game>
    joinGame(gameId: string): Promise<Game>
    declineGame(gameId: string): Promise<Game>
    clear(): void
}
