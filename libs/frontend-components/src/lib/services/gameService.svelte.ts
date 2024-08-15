import { Game, GameAction } from '@tabletop/common'

export type GameService = {
    isLoading(): boolean

    loadGames(): Promise<void>
    loadGame(id: string): Promise<{ game: Game; actions: GameAction[] }>

    createGame(game: Partial<Game>): Promise<Game>
    updateGame(game: Partial<Game>): Promise<Game>
    startGame(game: Game): Promise<Game>
    joinGame(gameId: string): Promise<Game>
    declineGame(gameId: string): Promise<Game>
    getActiveGames(): Game[]
    getWaitingGames(): Game[]
    getFinishedGames(): Game[]
    clear(): void
}
