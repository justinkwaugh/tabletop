import {
    GameEndReason,
    MachineState,
    finalTotals,
    gameEndReason,
    type FinalTotal,
    type PromontoryPointProjectedState
} from '@tabletop/promontory-point'

export type EndSummary = {
    // Highest final total first; a tie keeps seat order.
    totals: FinalTotal[]
    winnerIds: string[]
    reason: GameEndReason | undefined
}

// R-6.1
export const END_REASON_TEXT: Record<GameEndReason, string> = {
    [GameEndReason.RedTilesCovered]: 'Promontory is taken and at most one red tile is uncovered',
    [GameEndReason.BagEmpty]: 'The bag is empty'
}

// R-6.1, R-6.2, R-6.2-H1: the score read from the final state, never from an action.
export function endSummary(
    state: Pick<
        PromontoryPointProjectedState,
        'machineState' | 'players' | 'priceIndex' | 'towns' | 'track' | 'bag' | 'winningPlayerIds'
    >
): EndSummary | undefined {
    if (state.machineState !== MachineState.EndOfGame) {
        return undefined
    }
    return {
        totals: finalTotals(state).toSorted((a, b) => b.total - a.total),
        winnerIds: state.winningPlayerIds,
        reason: gameEndReason(state)
    }
}
