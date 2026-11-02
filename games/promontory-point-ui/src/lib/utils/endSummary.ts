import type { GameCall } from '@tabletop/common'
import {
    GameEndReason,
    MachineState,
    finalTotals,
    gameEndReason,
    type FinalTotal,
    type PromontoryPointProjectedState
} from '@tabletop/promontory-point'

export enum EndKind {
    // R-6.1: the game's own end, scored from the final state.
    Scored = 'scored',
    // docs/player-votes.md: a call, a concession or the stalled-game sweep ended it.
    Called = 'called'
}

export type ScoredEnd = {
    kind: EndKind.Scored
    // Highest final total first; a tie keeps seat order.
    totals: FinalTotal[]
    winnerIds: string[]
    reason: GameEndReason | undefined
}

// The call decides the result; no final totals are read (docs/player-votes.md).
export type CalledEnd = {
    kind: EndKind.Called
    call: GameCall
    // The declared winner, or none when the game was abandoned.
    winnerIds: string[]
}

export type EndSummary = ScoredEnd | CalledEnd

// R-6.1
export const END_REASON_TEXT: Record<GameEndReason, string> = {
    [GameEndReason.RedTilesCovered]: 'Promontory is taken and at most one red tile is uncovered',
    [GameEndReason.BagEmpty]: 'The bag is empty'
}

// R-6.1, R-6.2, R-6.2-H1: the score read from the final state, never from an action. A call
// (GameSession.gameCall, the call behind the displayed state) ends the game wherever the
// machine stood, and leaves the result it recorded.
export function endSummary(
    state: Pick<
        PromontoryPointProjectedState,
        'machineState' | 'players' | 'priceIndex' | 'towns' | 'track' | 'bag' | 'winningPlayerIds'
    >,
    call: GameCall | undefined
): EndSummary | undefined {
    if (call !== undefined) {
        return { kind: EndKind.Called, call, winnerIds: state.winningPlayerIds }
    }
    if (state.machineState !== MachineState.EndOfGame) {
        return undefined
    }
    return {
        kind: EndKind.Scored,
        totals: finalTotals(state).toSorted((a, b) => b.total - a.total),
        winnerIds: state.winningPlayerIds,
        reason: gameEndReason(state)
    }
}
