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

export interface GameStore {
    createGame(game: Game): Promise<Game>
    findGamesForUser(user: User): Promise<Game[]>
    findGameById(gameId: string, includeState: boolean): Promise<Game | undefined>
    findActionsForGame(gameId: string): Promise<GameAction[]>
    findActionRangeForGame({
        gameId,
        startIndex,
        endIndex
    }: {
        gameId: string
        startIndex: number
        endIndex: number
    }): Promise<GameAction[]>

    addActionsToGame({
        gameId,
        actions,
        state,
        validator
    }: {
        gameId: string
        actions: GameAction[]
        state: GameState
        validator?: ActionUpdateValidator
    }): Promise<{
        storedActions: GameAction[]
        updatedGame: Game
        relatedActions: GameAction[]
        priorState: GameState
    }>

    updateGame({
        gameId,
        fields,
        validator
    }: {
        gameId: string
        fields: Partial<Game>
        validator?: UpdateValidator<Game>
    }): Promise<[Game, string[], Game]>
}
