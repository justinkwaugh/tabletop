import type { Game, GameAction, GameState, User } from '@tabletop/common'

export interface GameStore {
    createGame(game: Game): Promise<Game>
    findGamesForUser(user: User): Promise<Game[]>
    findGameById(gameId: string, includeState: boolean): Promise<Game | undefined>
    updateGame({
        game,
        fields
    }: {
        game: Game
        fields: Partial<Game>
    }): Promise<[Game, string[], Game]>
    deleteGame(gameId: string): Promise<void>

    storeLocalGameData({
        game,
        actions,
        state
    }: {
        game: Game
        actions: GameAction[]
        state: GameState
    }): Promise<void>

    storeUndoData({
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

    findActionsForGame(game: Game): Promise<GameAction[]>
}
