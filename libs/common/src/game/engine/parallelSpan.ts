import { assert, assertExists } from '../../util/assertions.js'
import * as Value from 'typebox/value'
import type { BranchPoint, GameState, ParallelSpanState } from '../model/gameState.js'

export function sameBranchPoint(first: BranchPoint, second: BranchPoint): boolean {
    return Value.Equal(first, second)
}

export function isRestingInSpan(state: GameState): boolean {
    const span = state.parallelSpan
    return (
        span !== undefined &&
        span.branchPlayerId === undefined &&
        state.machineState === span.machineState
    )
}

export function restingSpan(state: GameState): ParallelSpanState {
    const span = state.parallelSpan
    assertExists(span, 'No Parallel Span is in progress')
    assert(isRestingInSpan(state), 'The Main Line is not resting in a Branching Machine State')
    return span
}

export function unmergedPlayerIds(span: ParallelSpanState): string[] {
    return span.playerIds.filter((playerId) => !span.mergedPlayerIds.includes(playerId))
}

export function spanAwaitingBranch(state: GameState, playerId: string): ParallelSpanState {
    const span = restingSpan(state)
    assert(span.playerIds.includes(playerId), `Player ${playerId} takes no part in this span`)
    assert(
        !span.mergedPlayerIds.includes(playerId),
        `The Branch of ${playerId} is already on the Main Line`
    )
    return span
}
