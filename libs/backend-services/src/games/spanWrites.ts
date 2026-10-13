import {
    GameStatus,
    belongsToSpan,
    isRestingInSpan,
    restingSpan,
    sameHistoryPosition,
    type Branch,
    type Game,
    type GameState,
    type ParallelSpanState,
    type UnmergedBranch
} from '@tabletop/common'
import type { UnmergedBranchWrite } from '../persistence/stores/gameStore.js'
import { GameNotInProgressError, GameUpdateCollisionError } from './errors.js'

export interface ExpectedBranch {
    readonly playerId: string
    readonly branch: Branch | undefined
}

export function freshBranchWrite({ branch, actions }: UnmergedBranch): UnmergedBranchWrite {
    return { branch, addedActions: actions, removedActions: [] }
}

export function assertGameInProgress(storedGame: Game): void {
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
    if (!sameHistoryPosition(storedState, expectedState)) {
        throw new GameUpdateCollisionError({ id: storedGame.id })
    }
}

export function assertSameSpan(
    gameId: string,
    storedState: GameState,
    span: ParallelSpanState
): void {
    if (
        !isRestingInSpan(storedState) ||
        !sameHistoryPosition(restingSpan(storedState).branchPoint, span.branchPoint)
    ) {
        throw new GameUpdateCollisionError({ id: gameId })
    }
}

export function assertBranchUnmoved(
    gameId: string,
    stored: Branch | undefined,
    expected: Branch | undefined
): void {
    const unmoved =
        stored === undefined || expected === undefined
            ? stored === expected
            : sameHistoryPosition(stored, expected) &&
              sameHistoryPosition(stored.branchPoint, expected.branchPoint)
    if (!unmoved) throw new GameUpdateCollisionError({ id: gameId })
}

export function assertBranchesUnmoved(
    gameId: string,
    span: ParallelSpanState,
    stored: readonly Branch[],
    expected: readonly ExpectedBranch[]
): void {
    const inSpan = stored.filter((branch) => belongsToSpan(branch, span))
    for (const { playerId, branch } of expected) {
        assertBranchUnmoved(
            gameId,
            inSpan.find((candidate) => candidate.playerId === playerId),
            branch
        )
    }
}
