import {
    GameEngine,
    GameResult,
    GameStatus,
    assertExists,
    isRestingInSpan,
    restingSpan,
    sameBranchPoint,
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
import {
    DisallowedActionError,
    GameNotInProgressError,
    GameUpdateCollisionError
} from './errors.js'

export type BranchSubmission =
    | {
          readonly kind: 'branch'
          readonly game: Game
          readonly state: GameState
          readonly unmergedBranch: UnmergedBranch
          readonly settlement?: SpanSettlement
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

export function actsInBranch(state: GameState, playerId: string | undefined): boolean {
    return (
        playerId !== undefined &&
        isRestingInSpan(state) &&
        unmergedPlayerIds(restingSpan(state)).includes(playerId)
    )
}

function belongsToSpan(branch: Branch, span: ParallelSpanState): boolean {
    return sameBranchPoint(branch.branchPoint, span.branchPoint)
}

export function siteActivePlayerIds(
    state: GameState,
    unmergedBranches: readonly UnmergedBranch[]
): string[] {
    if (!isRestingInSpan(state)) return state.activePlayerIds
    const span = restingSpan(state)
    const closedPlayerIds = unmergedBranches
        .filter(({ branch }) => branch.closed && belongsToSpan(branch, span))
        .map(({ branch }) => branch.playerId)
    return unmergedPlayerIds(span).filter((playerId) => !closedPlayerIds.includes(playerId))
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
        !sameBranchPoint(restingSpan(storedState).branchPoint, span.branchPoint)
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
              sameBranchPoint(stored.branchPoint, expected.branchPoint)
    if (!unmoved) throw new GameUpdateCollisionError({ id: gameId })
}

export function fillGameUpdatesAfterActions({
    definition,
    existingState,
    newState,
    gameUpdates,
    lastActionPlayerId,
    settlement,
    unmergedBranches
}: {
    definition: GameDefinition
    existingState: GameState
    newState: GameState
    gameUpdates: Partial<Game>
    lastActionPlayerId: string | undefined
    settlement: SpanSettlement | undefined
    unmergedBranches: readonly UnmergedBranch[]
}): void {
    gameUpdates.activePlayerIds = siteActivePlayerIds(newState, unmergedBranches)
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
        held: game.spanHold !== undefined
    })
    const assertOthersUnmoved = (found: readonly Branch[]) => {
        for (const otherPlayerId of otherPlayerIds) {
            assertBranchUnmoved(
                gameId,
                found.find((candidate) => candidate.playerId === otherPlayerId),
                others.find((record) => record.branch.playerId === otherPlayerId)?.branch
            )
        }
    }

    if (settlement.processedActions.length === 0) {
        const { updatedGame } = await gameStore.writeUnmergedBranch({
            gameId,
            write,
            watchBranchesOf: otherPlayerIds,
            validator: async (found) => {
                assertGameUnmoved(found.game, found.state, state)
                assertBranchUnmoved(gameId, found.branch, stored)
                assertOthersUnmoved(found.watchedBranches)
                fillGameUpdatesAfterActions({
                    definition,
                    existingState: found.state,
                    newState: state,
                    gameUpdates: found.gameUpdates,
                    lastActionPlayerId: playerId,
                    settlement,
                    unmergedBranches: [...others, mine]
                })
                return UpdateValidationResult.Proceed
            }
        })
        return { kind: 'branch', game: updatedGame, state, unmergedBranch: sent, settlement }
    }

    const merged = settlement.mergedPlayerIds
    const mineMerged = merged.includes(playerId)
    const remaining = [
        ...[...others, mine].filter((record) => !merged.includes(record.branch.playerId)),
        ...settlement.createdBranches
    ]
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
                assertOthersUnmoved(existingBranches)
                fillGameUpdatesAfterActions({
                    definition,
                    existingState,
                    newState,
                    gameUpdates,
                    lastActionPlayerId: playerId,
                    settlement,
                    unmergedBranches: remaining
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
