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
    deleteGame(game: Game): Promise<void>

    addActionsToGame({
        game,
        actions,
        state
    }: {
        game: Game
        actions: GameAction[]
        state: GameState
    }): Promise<{
        storedActions: GameAction[]
        updatedGame: Game
        relatedActions: GameAction[]
        priorState: GameState
    }>

    undoActionsFromGame({
        gameId,
        actions,
        redoneActions,
        state
    }: {
        gameId: string
        actions: GameAction[]
        redoneActions: GameAction[]
        state: GameState
    }): Promise<{
        undoneActions: GameAction[]
        updatedGame: Game
        redoneActions: GameAction[]
        priorState: GameState
    }>

    findActionById(game: Game, actionId: string): Promise<GameAction | undefined>
    findActionsForGame(game: Game): Promise<GameAction[]>

    storeCompleteGame(
        game: Game, // should include state
        actions: GameAction[]
    ): Promise<{
        storedGame: Game
        storedActions: GameAction[]
    }>

    getActionChecksum(gameId: string): Promise<number | undefined>
}
