import {
    GameEngine,
    GameResult,
    GameStatus,
    BranchUndoError,
    assert,
    assertExists,
    belongsToSpan,
    isRestingInSpan,
    restingSpan,
    sameHistoryPosition,
    settleSpan,
    unmergedPlayerIds,
    type Branch,
    type Game,
    type GameAction,
    type GameDefinition,
    type GameState,
    type ParallelSpanState,
    type SpanSettlement,
    type UnmergedBranch
} from '@tabletop/common'
import { measureSync } from '../diagnostics/requestTimings.js'
import type { GameStore, UnmergedBranchWrite } from '../persistence/stores/gameStore.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import type { ReopenedBranch } from './spanReversal.js'
import {
    DisallowedActionError,
    DisallowedUndoError,
    GameNotInProgressError,
    GameUpdateCollisionError
} from './errors.js'

export type BranchSubmission =
    | {
          readonly kind: 'branch'
          readonly game: Game
          readonly state: GameState
          readonly unmergedBranch: UnmergedBranch
      }
    | {
          readonly kind: 'mainLine'
          readonly updatedGame: Game
          readonly settlement: SpanSettlement
          readonly storedActions: GameAction[]
          readonly relatedActions: GameAction[]
          readonly priorState: GameState
          readonly unmergedBranch?: UnmergedBranch
      }

export function freshBranchWrite({ branch, actions }: UnmergedBranch): UnmergedBranchWrite {
    return { branch, addedActions: actions, removedActions: [] }
}

function assertGameInProgress(storedGame: Game): void {
    if (storedGame.status !== GameStatus.Started) {
        throw new GameNotInProgressError({ id: storedGame.id })
    }
}

export function assertGameUnmoved(
    storedGame: Game,
    storedState: GameState,
    expectedState: GameState
): void {
    assertGameInProgress(storedGame)
    if (
        storedState.actionCount !== expectedState.actionCount ||
        storedState.actionChecksum !== expectedState.actionChecksum
    ) {
        throw new GameUpdateCollisionError({ id: storedGame.id })
    }
}

function assertSameSpan(gameId: string, storedState: GameState, span: ParallelSpanState): void {
    if (
        !isRestingInSpan(storedState) ||
        !sameHistoryPosition(restingSpan(storedState).branchPoint, span.branchPoint)
    ) {
        throw new GameUpdateCollisionError({ id: gameId })
    }
}

function assertBranchUnmoved(
    gameId: string,
    stored: Branch | undefined,
    expected: Branch | undefined
): void {
    const unmoved =
        stored === undefined || expected === undefined
            ? stored === expected
            : stored.actionCount === expected.actionCount &&
              stored.actionChecksum === expected.actionChecksum &&
              sameHistoryPosition(stored.branchPoint, expected.branchPoint)
    if (!unmoved) throw new GameUpdateCollisionError({ id: gameId })
}

export function fillGameUpdatesAfterActions({
    definition,
    existingState,
    newState,
    gameUpdates,
    lastActionPlayerId,
    settlement
}: {
    definition: GameDefinition
    existingState: GameState
    newState: GameState
    gameUpdates: Partial<Game>
    lastActionPlayerId: string | undefined
    settlement: SpanSettlement | undefined
}): void {
    gameUpdates.activePlayerIds = newState.activePlayerIds
    if (lastActionPlayerId !== undefined) {
        gameUpdates.lastActionPlayerId = lastActionPlayerId
    }
    if (
        !existingState.result &&
        newState.result &&
        newState.result !== GameResult.Abandoned &&
        definition.runtime.scoring
    ) {
        gameUpdates.finalScores = definition.runtime.scoring.finalScores(newState)
    }
    if (settlement?.refusal !== undefined) {
        gameUpdates.spanHold = settlement.refusal
    }
}

export async function submitBranchAction({
    gameStore,
    definition,
    game,
    action
}: {
    gameStore: GameStore
    definition: GameDefinition
    game: Game
    action: GameAction
}): Promise<BranchSubmission> {
    const gameId = game.id
    const state = game.state
    const playerId = action.playerId
    assertExists(state, 'A Branch Action requires current Game State')
    assertExists(playerId, 'A Branch Action requires its Player')
    const span = restingSpan(state)
    const engine = new GameEngine(definition.runtime)

    const stored = await gameStore.findBranch(gameId, playerId)
    const existing = stored !== undefined && belongsToSpan(stored, span) ? stored : undefined
    const started =
        existing === undefined ? engine.createBranch({ state, game, playerId }) : undefined
    const branch = existing ?? started?.branch
    assertExists(branch, `Player ${playerId} has no Branch to act in`)
    if (branch.closed) {
        throw new DisallowedActionError({
            gameId,
            actionId: action.id,
            reason: 'your Branch is closed'
        })
    }

    const execution = measureSync('engine.execute', () =>
        engine.executeBranchAction({ state, branch, action, game })
    )
    const addedActions = [...(started?.processedActions ?? []), ...execution.processedActions]
    const write: UnmergedBranchWrite = {
        branch: execution.branch,
        addedActions,
        removedActions: []
    }
    const sent = { branch: execution.branch, actions: addedActions }

    if (!execution.branch.closed) {
        await gameStore.writeUnmergedBranch({
            gameId,
            write,
            validator: async (found) => {
                assertGameInProgress(found.game)
                assertSameSpan(gameId, found.state, span)
                assertBranchUnmoved(gameId, found.branch, stored)
                return UpdateValidationResult.Proceed
            }
        })
        return { kind: 'branch', game, state, unmergedBranch: sent }
    }

    const unmerged = unmergedPlayerIds(span)
    const otherPlayerIds = unmerged.filter((unmergedPlayerId) => unmergedPlayerId !== playerId)
    const inSpan = (await gameStore.findUnmergedBranches(gameId, unmerged)).filter((record) =>
        belongsToSpan(record.branch, span)
    )
    const mineStored = inSpan.find((record) => record.branch.playerId === playerId)
    assertBranchUnmoved(gameId, mineStored?.branch, existing)
    const mine = {
        branch: execution.branch,
        actions: [...(mineStored?.actions ?? []), ...addedActions]
    }
    const others = inSpan.filter((record) => record.branch.playerId !== playerId)
    const settlement = settleSpan({
        engine,
        game,
        state,
        unmergedBranches: [...others, mine],
        mergesHeld: game.spanHold !== undefined
    })
    assert(
        settlement.processedActions.length > 0,
        'Closing a Branch puts its Branch Close on the Main Line'
    )

    const merged = settlement.mergedPlayerIds
    const mineMerged = merged.includes(playerId)
    const { storedActions, updatedGame, relatedActions, priorState } =
        await gameStore.addActionsToGame({
            game,
            actions: settlement.processedActions,
            state: settlement.updatedState,
            unmergedBranchWrites: {
                set: [
                    ...(mineMerged ? [] : [write]),
                    ...settlement.createdBranches.map(freshBranchWrite)
                ],
                removeBranchesOf: merged,
                watchBranchesOf: unmerged
            },
            validator: async (
                existingGame,
                existingState,
                newState,
                _actions,
                gameUpdates,
                _relatedActions,
                existingBranches
            ) => {
                assertGameUnmoved(existingGame, existingState, state)
                assertBranchUnmoved(
                    gameId,
                    existingBranches.find((candidate) => candidate.playerId === playerId),
                    stored
                )
                assertBranchesUnmoved(gameId, otherPlayerIds, existingBranches, others)
                fillGameUpdatesAfterActions({
                    definition,
                    existingState,
                    newState,
                    gameUpdates,
                    lastActionPlayerId: playerId,
                    settlement
                })
                return UpdateValidationResult.Proceed
            }
        })

    return {
        kind: 'mainLine',
        updatedGame,
        settlement,
        storedActions,
        relatedActions,
        priorState,
        unmergedBranch: mineMerged
            ? settlement.createdBranches.find((record) => record.branch.playerId === playerId)
            : sent
    }
}

export function assertBranchesUnmoved(
    gameId: string,
    playerIds: readonly string[],
    stored: readonly Branch[],
    expected: readonly UnmergedBranch[]
): void {
    for (const playerId of playerIds) {
        assertBranchUnmoved(
            gameId,
            stored.find((candidate) => candidate.playerId === playerId),
            expected.find((record) => record.branch.playerId === playerId)?.branch
        )
    }
}

export type BranchUndo =
    | { readonly kind: 'branch'; readonly unmergedBranch: UnmergedBranch }
    | {
          readonly kind: 'reopen'
          readonly unmergedBranch: UnmergedBranch
          readonly reopened: ReopenedBranch
      }

export async function undoBranchAction({
    gameStore,
    definition,
    game,
    actionId,
    playerIds,
    asAdministrator
}: {
    gameStore: GameStore
    definition: GameDefinition
    game: Game
    actionId: string
    playerIds: readonly string[]
    asAdministrator: boolean
}): Promise<BranchUndo | undefined> {
    const gameId = game.id
    const state = game.state
    assertExists(state, 'A Branch Undo requires current Game State')
    if (!isRestingInSpan(state)) return undefined
    const span = restingSpan(state)
    const refuse = (reason: string) => new DisallowedUndoError({ gameId, actionId, reason })

    const target = (await gameStore.findUnmergedBranches(gameId, playerIds)).find(
        (record) =>
            belongsToSpan(record.branch, span) &&
            record.actions.some((action) => action.id === actionId)
    )
    if (target === undefined) return undefined

    const engine = new GameEngine(definition.runtime)
    const undone = (() => {
        try {
            return engine.undoBranchAction({ state, ...target, actionId, asAdministrator })
        } catch (error) {
            if (error instanceof BranchUndoError) throw refuse(error.message)
            throw error
        }
    })()
    const unmergedBranch = { branch: undone.branch, actions: [] }
    if (target.branch.closed) {
        return {
            kind: 'reopen',
            unmergedBranch,
            reopened: { branch: undone.branch, undoneActions: undone.undoneActions }
        }
    }

    await gameStore.writeUnmergedBranch({
        gameId,
        write: { branch: undone.branch, addedActions: [], removedActions: undone.undoneActions },
        validator: async (found) => {
            assertGameInProgress(found.game)
            assertSameSpan(gameId, found.state, span)
            assertBranchUnmoved(gameId, found.branch, target.branch)
            return UpdateValidationResult.Proceed
        }
    })
    return { kind: 'branch', unmergedBranch }
}
