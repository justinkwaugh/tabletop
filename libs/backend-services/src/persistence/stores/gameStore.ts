import { GameAction, Game, GameState, User } from '@tabletop/common'
import { UpdateValidationResult, UpdateValidator } from './validator.js'

export type ActionUpdateValidator = (
    existingGame: Game,
    existingState: GameState,
    newState: GameState,
    actions: GameAction[],
    gameUpdates: Partial<Game>,
    relatedActions: GameAction[]
) => Promise<UpdateValidationResult>

export type ActionUndoValidator = (
    existingGame: Game,
    existingState: GameState,
    existingActions: GameAction[],

    newState: GameState,
    gameUpdates: Partial<Game>
) => Promise<UpdateValidationResult>

export interface GameStore {
    createGame(game: Game): Promise<Game>
    getGameEtag(gameId: string): Promise<string | undefined>
    findGamesForUser(user: User): Promise<Game[]>
    findGameById(gameId: string, includeState: boolean): Promise<Game | undefined>
    findActionById(game: Game, actionId: string): Promise<GameAction | undefined>
    findActionsForGame(game: Game): Promise<GameAction[]>
    findActionRangeForGame({
        game,
        startIndex,
        endIndex
    }: {
        game: Game
        startIndex: number
        endIndex: number
    }): Promise<GameAction[]>

    addActionsToGame({
        game,
        actions,
        state,
        validator
    }: {
        game: Game
        actions: GameAction[]
        state: GameState
        validator?: ActionUpdateValidator
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
        state,
        validator
    }: {
        gameId: string
        actions: GameAction[]
        redoneActions: GameAction[]
        state: GameState
        validator?: ActionUndoValidator
    }): Promise<{
        undoneActions: GameAction[]
        updatedGame: Game
        redoneActions: GameAction[]
        priorState: GameState
    }>

    updateGame({
        game,
        fields,
        validator
    }: {
        game: Game
        fields: Partial<Game>
        validator?: UpdateValidator<Game>
    }): Promise<[Game, string[], Game]>

    deleteGame(game: Game): Promise<void>

    getActionChecksum(gameId: string): Promise<number | undefined>

    // This is just for seamless migration to the new checksum system
    setChecksum({ gameId, checksum }: { gameId: string; checksum: number }): Promise<number>
}
