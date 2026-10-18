import {
    GameEngine,
    GameResult,
    assert,
    assertExists,
    belongsToSpan,
    createBranch,
    executeBranchAction,
    executeCommonAction,
    restingSpan,
    sameBranchExecution,
    sameHistoryPosition,
    settleCommonActionRace,
    settleSpan,
    unmergedPlayerIds,
    type ActionCascadeResult,
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
import { DisallowedActionError, GameUpdateCollisionError, RacedActionError } from './errors.js'
import {
    assertBranchUnmoved,
    assertBranchesUnmoved,
    assertGameInProgress,
    assertGameUnmoved,
    assertSameSpan,
    freshBranchWrite,
    type ExpectedBranch
} from './spanWrites.js'

export type BranchSubmission =
    | { readonly kind: 'branch'; readonly unmergedBranch: UnmergedBranch }
    | {
          readonly kind: 'mainLine'
          readonly updatedGame: Game
          readonly settlement: SpanSettlement
          readonly storedActions: GameAction[]
          readonly relatedActions: GameAction[]
          readonly priorState: GameState
          readonly unmergedBranch?: UnmergedBranch
      }

export interface CommonSubmission {
    readonly updatedGame: Game
    readonly result: ActionCascadeResult
    readonly storedActions: GameAction[]
    readonly relatedActions: GameAction[]
    readonly priorState: GameState
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
        existing === undefined ? createBranch({ engine, state, game, playerId }) : undefined
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
        executeBranchAction({ engine, state, branch, action, game })
    )
    const addedActions = [...(started?.processedActions ?? []), ...execution.processedActions]
    const write = { branch: execution.branch, addedActions, removedActions: [] }

    if (execution.branch.closed) {
        return closeOnMainLine({
            gameStore,
            definition,
            engine,
            game,
            state,
            span,
            write,
            existing
        })
    }
    await gameStore.writeUnmergedBranch({
        gameId,
        write,
        validator: async (found) => {
            if (started === undefined) {
                assertGameInProgress(found.game)
                assertSameSpan(gameId, found.state, span)
            } else {
                assertGameUnmoved(found.game, found.state, state)
            }
            assertBranchUnmoved(gameId, found.branch, stored)
            if (!sameHistoryPosition(found.state, state)) {
                assertSameOnCurrentMainLine({
                    engine,
                    game,
                    state: found.state,
                    branch,
                    action,
                    execution
                })
            }
        }
    })
    return { kind: 'branch', unmergedBranch: { branch: execution.branch, actions: addedActions } }
}

// A Branch Action is worked out over the Main Line its Branch View rested on. A Common Action
// may have landed since, such as the Player's own offer holding what the Action uses, so the
// write runs it again over the current Main Line and collides unless it reaches the same Branch
// by the same run; the retry then works it out afresh.
function assertSameOnCurrentMainLine({
    engine,
    game,
    state,
    branch,
    action,
    execution
}: {
    engine: GameEngine
    game: Game
    state: GameState
    branch: Branch
    action: GameAction
    execution: ReturnType<typeof executeBranchAction>
}): void {
    let again: ReturnType<typeof executeBranchAction>
    try {
        again = executeBranchAction({
            engine,
            state,
            branch,
            action: structuredClone(action),
            game
        })
    } catch {
        throw new GameUpdateCollisionError({ id: game.id })
    }
    if (!sameBranchExecution(execution, again)) throw new GameUpdateCollisionError({ id: game.id })
}

async function closeOnMainLine({
    gameStore,
    definition,
    engine,
    game,
    state,
    span,
    write,
    existing
}: {
    gameStore: GameStore
    definition: GameDefinition
    engine: GameEngine
    game: Game
    state: GameState
    span: ParallelSpanState
    write: UnmergedBranchWrite
    existing: Branch | undefined
}): Promise<BranchSubmission> {
    const gameId = game.id
    const playerId = write.branch.playerId
    const inSpan = (await gameStore.findUnmergedBranches(gameId, unmergedPlayerIds(span))).filter(
        (record) => belongsToSpan(record.branch, span)
    )
    const mineStored = inSpan.find((record) => record.branch.playerId === playerId)
    assertBranchUnmoved(gameId, mineStored?.branch, existing)
    const mine = {
        branch: write.branch,
        actions: [...(mineStored?.actions ?? []), ...write.addedActions]
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
    const created = settlement.createdBranches
    const expected: ExpectedBranch[] = [
        { playerId, branch: existing },
        ...others
            .filter(({ branch }) => branch.closed)
            .map(({ branch }) => ({ playerId: branch.playerId, branch })),
        ...created
            .map(({ branch }) => branch.playerId)
            .filter((createdFor) => inSpan.every(({ branch }) => branch.playerId !== createdFor))
            .map((createdFor) => ({ playerId: createdFor, branch: undefined }))
    ]
    const { storedActions, updatedGame, relatedActions, priorState } =
        await gameStore.addActionsToGame({
            game,
            actions: settlement.processedActions,
            state: settlement.updatedState,
            unmergedBranchWrites: {
                set: [...(mineMerged ? [] : [write]), ...created.map(freshBranchWrite)],
                removeBranchesOf: merged,
                watchBranchesOf: expected.map((branch) => branch.playerId)
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
                assertBranchesUnmoved(gameId, span, existingBranches, expected)
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
            ? created.find((record) => record.branch.playerId === playerId)
            : { branch: write.branch, actions: [...write.addedActions] }
    }
}

async function reconcileCommonActionRace({
    gameStore,
    engine,
    game,
    state,
    action
}: {
    gameStore: GameStore
    engine: GameEngine
    game: Game
    state: GameState
    action: GameAction
}): Promise<GameAction[]> {
    if (action.index === undefined || action.index >= state.actionCount) return []
    const raced = await gameStore.findActionRangeForGame({
        game,
        startIndex: action.index,
        endIndex: state.actionCount
    })
    const outcome = settleCommonActionRace({ engine, game, state, raced, late: action })
    if (outcome.kind === 'invalid') {
        throw new RacedActionError({ gameId: game.id, actionId: action.id, reason: outcome.reason })
    }
    action.index = state.actionCount
    return raced
}

// The acting Player's own side, as their stored Branch has it: the Branch to check the Common
// Action against, and what the write must find unmoved for the check to still hold.
async function ownBranchToCheck({
    gameStore,
    engine,
    game,
    state,
    span,
    playerId
}: {
    gameStore: GameStore
    engine: GameEngine
    game: Game
    state: GameState
    span: ParallelSpanState
    playerId: string
}): Promise<{ branch: Branch; expected: ExpectedBranch } | undefined> {
    if (!unmergedPlayerIds(span).includes(playerId)) return undefined
    const stored = await gameStore.findBranch(game.id, playerId)
    const inSpan = stored !== undefined && belongsToSpan(stored, span) ? stored : undefined
    return {
        branch: inSpan ?? createBranch({ engine, state, game, playerId }).branch,
        expected: { playerId, branch: inSpan }
    }
}

export async function submitCommonAction({
    gameStore,
    definition,
    game,
    action
}: {
    gameStore: GameStore
    definition: GameDefinition
    game: Game
    action: GameAction
}): Promise<CommonSubmission> {
    const gameId = game.id
    const state = game.state
    const playerId = action.playerId
    assertExists(state, 'A Common Action requires current Game State')
    assertExists(playerId, 'A Common Action requires its Player')
    const span = restingSpan(state)
    const disallowed = (reason: string) =>
        new DisallowedActionError({ gameId, actionId: action.id, reason })
    if (!span.playerIds.includes(playerId)) throw disallowed('you take no part in this span')

    const engine = new GameEngine(definition.runtime)
    const raced = await reconcileCommonActionRace({ gameStore, engine, game, state, action })
    const own = await ownBranchToCheck({ gameStore, engine, game, state, span, playerId })
    const outcome = measureSync('engine.execute', () =>
        executeCommonAction({ engine, game, state, action, branch: own?.branch })
    )
    if (outcome.kind === 'refused') throw disallowed(outcome.reason)
    const { result } = outcome
    const expected = own === undefined ? [] : [own.expected]

    const { storedActions, updatedGame, relatedActions, priorState } =
        await gameStore.addActionsToGame({
            game,
            actions: result.processedActions,
            state: result.updatedState,
            unmergedBranchWrites: {
                set: [],
                removeBranchesOf: [],
                watchBranchesOf: expected.map((branch) => branch.playerId)
            },
            validator: async (
                existingGame,
                existingState,
                newState,
                _actions,
                gameUpdates,
                relatedActions,
                existingBranches
            ) => {
                assertGameUnmoved(existingGame, existingState, state)
                assertBranchesUnmoved(gameId, span, existingBranches, expected)
                relatedActions.push(...raced)
                fillGameUpdatesAfterActions({
                    definition,
                    existingState,
                    newState,
                    gameUpdates,
                    lastActionPlayerId: playerId,
                    settlement: undefined
                })
                return UpdateValidationResult.Proceed
            }
        })
    return { updatedGame, result, storedActions, relatedActions, priorState }
}
