import { assert, assertExists } from '../../util/assertions.js'
import type { ActionHistoryPosition, GameState, ParallelSpanState } from '../model/gameState.js'
import { ActionSource, type GameAction } from './gameAction.js'

export const BranchCloseActionType = 'tabletop.branch-close' as const

export function sameHistoryPosition(
    first: ActionHistoryPosition,
    second: ActionHistoryPosition
): boolean {
    return (
        first.actionCount === second.actionCount && first.actionChecksum === second.actionChecksum
    )
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

export function waitedOnPlayerIds(span: ParallelSpanState): string[] {
    return span.playerIds.filter(
        (playerId) =>
            !span.closedPlayerIds.includes(playerId) && !span.mergedPlayerIds.includes(playerId)
    )
}

export function returnedPlayerIds(span: ParallelSpanState): string[] {
    return span.mergedPlayerIds.filter((playerId) => !span.closedPlayerIds.includes(playerId))
}

export function closedUnmergedPlayerIds(span: ParallelSpanState): string[] {
    return span.closedPlayerIds.filter((playerId) => !span.mergedPlayerIds.includes(playerId))
}

export function spanActivePlayerIds(span: ParallelSpanState): string[] {
    return span.branchPlayerId === undefined ? waitedOnPlayerIds(span) : [span.branchPlayerId]
}

export function isBranchClose(action: Pick<GameAction, 'type'>): boolean {
    return action.type === BranchCloseActionType
}

export function spanRuns(actions: readonly GameAction[], span: ParallelSpanState): GameAction[][] {
    const branchStartIds = Object.values(span.branchStartIds)
    const runs: GameAction[][] = []
    for (const action of actions) {
        const previous = runs.at(-1)
        const beginsRun =
            previous === undefined ||
            isBranchClose(previous[0]) ||
            isBranchClose(action) ||
            action.source === ActionSource.User ||
            branchStartIds.includes(action.id)
        if (beginsRun) runs.push([action])
        else previous.push(action)
    }
    return runs
}

export function actsInBranch(state: GameState, playerId: string | undefined): boolean {
    return (
        playerId !== undefined &&
        isRestingInSpan(state) &&
        unmergedPlayerIds(restingSpan(state)).includes(playerId)
    )
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
