import {
    GameCreationOptions,
    GameAction,
    Game,
    GameState,
    User,
    GameStatusCategory,
    GameHistoryPage,
    GameHistoryCursor,
    Branch,
    UnmergedBranch
} from '@tabletop/common'
import { UpdateValidationResult, UpdateValidator } from './validator.js'

export type ActionUpdateValidator = (
    existingGame: Game,
    existingState: GameState,
    newState: GameState,
    actions: GameAction[],
    gameUpdates: Partial<Game>,
    relatedActions: GameAction[],
    existingBranches: Branch[]
) => Promise<UpdateValidationResult>

export type BranchWriteValidator = (existing: {
    game: Game
    state: GameState
    branch: Branch | undefined
    watchedBranches: Branch[]
    gameUpdates: Partial<Game>
}) => Promise<UpdateValidationResult>

export interface UnmergedBranchWrite {
    readonly branch: Branch
    readonly addedActions: readonly GameAction[]
    readonly removedActions: readonly GameAction[]
}

export interface UnmergedBranchWrites {
    readonly set: readonly UnmergedBranchWrite[]
    readonly removeBranchesOf: readonly string[]
    readonly watchBranchesOf?: readonly string[]
}

export type ActionUndoValidator = (
    existingGame: Game,
    existingState: GameState,
    existingActions: GameAction[],

    newState: GameState,
    gameUpdates: Partial<Game>
) => Promise<UpdateValidationResult>

export type UndoActionWindow = {
    targetAction: GameAction
    startIndex: number
    actions: GameAction[]
}

export type GameData = { game: Game; actions: GameAction[] }

export interface GameDataReader {
    readonly game: Game
    actions(): Promise<GameAction[]>
    actionRange(startIndex: number, endIndex: number): Promise<GameAction[]>
    undoWindow(actionId: string): Promise<UndoActionWindow | undefined>
}

export interface GameStore {
    loadGameData(gameId: string): Promise<GameData | undefined>
    readGameData<T>(
        gameId: string,
        read: (reader: GameDataReader) => Promise<T>
    ): Promise<T | undefined>
    createGame(game: Game, options?: GameCreationOptions): Promise<Game>
    getMasterSeed(gameId: string): Promise<string | undefined>
    writeFullGameData(
        game: Game,
        state: GameState,
        actions: GameAction[]
    ): Promise<{
        storedGame: Game
        storedGameState: GameState
        storedActions: GameAction[]
    }>
    getGameEtag(gameId: string): Promise<string | undefined>
    hasCachedActiveGames(user: User): Promise<boolean>
    findGamesForUser(user: User, category: GameStatusCategory): Promise<Game[]>
    findGameHistory(user: User, before?: GameHistoryCursor): Promise<GameHistoryPage>
    findOpenGamesForTitle(titleId: string): Promise<Game[]>
    findActiveGamesForTitle(titleId: string): Promise<Game[]>
    findGameById(gameId: string, includeState: boolean): Promise<Game | undefined>
    findUndoActionWindow({
        game,
        actionId,
        endIndex
    }: {
        game: Game
        actionId: string
        endIndex: number
    }): Promise<UndoActionWindow | undefined>
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

    findBranch(gameId: string, playerId: string): Promise<Branch | undefined>
    findUnmergedBranch(gameId: string, playerId: string): Promise<UnmergedBranch | undefined>
    findUnmergedBranches(gameId: string, playerIds: readonly string[]): Promise<UnmergedBranch[]>
    writeUnmergedBranch({
        gameId,
        write,
        watchBranchesOf,
        validator
    }: {
        gameId: string
        write: UnmergedBranchWrite
        watchBranchesOf?: readonly string[]
        validator: BranchWriteValidator
    }): Promise<{ written: boolean; updatedGame: Game }>

    addActionsToGame({
        game,
        actions,
        state,
        unmergedBranchWrites,
        validator
    }: {
        game: Game
        actions: GameAction[]
        state: GameState
        unmergedBranchWrites?: UnmergedBranchWrites
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
        removeUnmergedBranches,
        validator
    }: {
        gameId: string
        actions: GameAction[]
        redoneActions: GameAction[]
        state: GameState
        removeUnmergedBranches?: boolean
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
    setGameState({ gameId, state }: { gameId: string; state: GameState }): Promise<void>

    // This is just for seamless migration to the new checksum system
    setChecksum({ gameId, checksum }: { gameId: string; checksum: number }): Promise<number>
}
