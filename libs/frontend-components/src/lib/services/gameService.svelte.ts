import { Game, GameAction, GameState } from '@tabletop/common'

export type GameService = {
    loadGames(): Promise<void>
    loadGame(gameId: string): Promise<{ game?: Game; actions: GameAction[] }>

    createGame(game: Partial<Game>): Promise<Game>
    forkGame(game: Partial<Game>, actionIndex: number): Promise<Game>
    updateGame(game: Partial<Game>): Promise<Game>
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
}
