import { assert, assertExists } from '../../util/assertions.js'
import { belongsToSpan, BranchMergeError, type UnmergedBranch } from './branch.js'
import { combineCascades, type ActionCascadeResult, type GameEngine } from './gameEngine.js'
import {
    closedUnmergedPlayerIds,
    isRestingInSpan,
    restingSpan,
    unmergedPlayerIds
} from './parallelSpan.js'
import type { GameAction } from './gameAction.js'
import type { Game, SpanHold } from '../model/game.js'
import type { GameState, HydratedGameState } from '../model/gameState.js'

export interface SpanSettlement<T extends GameState = GameState> extends ActionCascadeResult<T> {
    readonly createdBranches: UnmergedBranch[]
    readonly mergedPlayerIds: string[]
    readonly refusal?: SpanHold
}

export function createMissingBranches<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    unmergedBranches
}: {
    engine: GameEngine<T, U>
    game: Game
    state: T
    unmergedBranches: readonly UnmergedBranch[]
}): UnmergedBranch[] {
    if (!isRestingInSpan(state)) return []
    const held = unmergedBranches.map(({ branch }) => branch.playerId)
    return unmergedPlayerIds(restingSpan(state))
        .filter((playerId) => !held.includes(playerId))
        .map((playerId) => {
            const started = engine.createBranch({ state, game, playerId })
            return { branch: started.branch, actions: started.processedActions }
        })
}

export function settleSpan<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    unmergedBranches,
    mergesHeld = false
}: {
    engine: GameEngine<T, U>
    game: Game
    state: T
    unmergedBranches: readonly UnmergedBranch[]
    mergesHeld?: boolean
}): SpanSettlement<T> {
    const steps: ActionCascadeResult<T>[] = []
    const created: UnmergedBranch[] = []
    const mergedPlayerIds: string[] = []
    let known = new Map(unmergedBranches.map((record) => [record.branch.playerId, record]))
    let current = state
    let refusal: SpanHold | undefined

    while (isRestingInSpan(current) && refusal === undefined) {
        const span = restingSpan(current)
        const unmerged = unmergedPlayerIds(span)
        known = new Map([...known].filter(([, record]) => belongsToSpan(record.branch, span)))
        for (const record of createMissingBranches({
            engine,
            game,
            state: current,
            unmergedBranches: [...known.values()]
        })) {
            known.set(record.branch.playerId, record)
            created.push(record)
        }
        const closing = unmerged.filter(
            (playerId) =>
                known.get(playerId)?.branch.closed === true &&
                !span.closedPlayerIds.includes(playerId)
        )
        if (closing.length > 0) {
            for (const playerId of closing) {
                const closed = engine.closeBranch({ state: current, playerId })
                steps.push(closed)
                current = closed.updatedState
            }
            continue
        }
        if (mergesHeld) break

        if (unmerged.length === 0) {
            const completed = engine.completeSpan({ state: current, game })
            steps.push(completed)
            current = completed.updatedState
            continue
        }

        const playerId = engine.nextBranchToMerge({ state: current })
        if (playerId === undefined) break
        const record = known.get(playerId)
        assertExists(record, `The Branch of ${playerId} is ready to merge but unknown`)
        try {
            const merged = engine.mergeBranch({ state: current, game, ...record })
            steps.push(merged)
            current = merged.updatedState
            mergedPlayerIds.push(playerId)
            known.delete(playerId)
        } catch (error) {
            if (!(error instanceof BranchMergeError)) throw error
            refusal = { playerId, reason: error.message }
        }
    }

    return {
        ...combineCascades(state, steps),
        createdBranches: created.filter((record) => known.get(record.branch.playerId) === record),
        mergedPlayerIds,
        ...(refusal === undefined ? {} : { refusal })
    }
}

interface Reversal<T extends GameState, U extends HydratedGameState<T>> {
    engine: GameEngine<T, U>
    state: T
    history: readonly GameAction[]
}

function reverseUntil<T extends GameState, U extends HydratedGameState<T>>(
    { engine, state, history }: Reversal<T, U>,
    landed: (state: T) => boolean
): { state: T; reversed: GameAction[] } {
    const remaining = [...history]
    const reversed: GameAction[] = []
    let current = state
    while (!landed(current)) {
        const action = remaining.pop()
        assertExists(action, 'The Action History given does not reach the start of the Branch')
        current = engine.undoProcessedAction({ action, state: current })
        reversed.unshift(action)
    }
    return { state: current, reversed }
}

function isOutsideEveryBranch(state: GameState): boolean {
    return state.parallelSpan?.branchPlayerId === undefined
}

function holdsNoUnmergedClose(state: GameState): boolean {
    const span = state.parallelSpan
    return span === undefined || closedUnmergedPlayerIds(span).length === 0
}

export function removeBranchCloses<T extends GameState, U extends HydratedGameState<T>>({
    engine,
    game,
    state,
    history,
    playerIds
}: Reversal<T, U> & { game: Game; playerIds: readonly string[] }): {
    state: T
    removed: GameAction[]
    replayed: GameAction[]
} {
    if (playerIds.length === 0) return { state, removed: [], replayed: [] }
    const span = restingSpan(state)
    const closeIds = playerIds.map((playerId) => span.branchCloseIds[playerId])
    const isRemovedClose = (action: GameAction) => closeIds.includes(action.id)
    assert(
        playerIds.every((playerId) => closedUnmergedPlayerIds(span).includes(playerId)),
        'Only the Branch Close of a Branch not yet on the Main Line can be removed'
    )
    assert(
        history.filter(isRemovedClose).length === playerIds.length,
        'The Main Line given does not hold every Branch Close to remove'
    )
    const removed = history.slice(history.findIndex(isRemovedClose))
    let earlier = state
    for (const action of removed.toReversed()) {
        earlier = engine.undoProcessedAction({ action, state: earlier })
    }
    const replayed = engine.replayOnSpan({
        state: earlier,
        game,
        recorded: removed.filter((action) => !isRemovedClose(action))
    })
    return { state: replayed.updatedState, removed, replayed: replayed.processedActions }
}

export function reverseToBranchStart<T extends GameState, U extends HydratedGameState<T>>(
    reversal: Reversal<T, U>
): { state: T; reversed: GameAction[] } {
    return reverseUntil(reversal, isOutsideEveryBranch)
}

export function reverseToForkPosition<T extends GameState, U extends HydratedGameState<T>>(
    reversal: Reversal<T, U>
): { state: T; reversed: GameAction[] } {
    return reverseUntil(
        reversal,
        (state) => isOutsideEveryBranch(state) && holdsNoUnmergedClose(state)
    )
}
