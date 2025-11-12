import type { Game, GameAction, GameState, User } from '@tabletop/common'

export interface GameStore {
    createGame(game: Game, state: GameState): Promise<Game>
    loadGameData(gameId: string): Promise<{ game?: Game; actions: GameAction[] }>
    findGamesForUser(user: User): Promise<Game[]>
    findGameById(gameId: string, includeState: boolean): Promise<Game | undefined>
    deleteGame(gameId: string): Promise<void>

    storeGameData({
        game,
        actions,
        state
    }: {
        game: Game
        actions: GameAction[]
        state: GameState
    }): Promise<void>
}
