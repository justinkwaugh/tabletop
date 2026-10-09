import type { EighteenXXState } from '@tabletop/18xx'
import { assert, RecordedHistory, type GameAction, type RecordedTransition } from '@tabletop/common'

function selectHistoryState(state: Readonly<EighteenXXState>) {
    const cash = new Map<string, number>()
    for (const entry of state.cash) {
        if (entry.owner.kind !== 'company') continue
        assert(typeof entry.amount === 'number', 'Company history requires finite cash')
        cash.set(entry.owner.companyId, entry.amount)
    }
    return {
        cash,
        phase: state.phaseId,
        stock: state.stockRound.number,
        operating: state.stockRound.completed,
        setUnderWay: !!state.operatingSet && !state.operatingSet.completed,
        set: state.operatingSet?.number ?? 1,
        round: state.operatingSet?.roundNumber ?? 1,
        order: state.operatingSet?.companyOrder ?? [],
        auction: !!(
            (state.offerAuction && !state.offerAuction.completed) ||
            (state.openingAuction && !state.openingAuction.completed) ||
            (state.selectionAuction && !state.selectionAuction.completed)
        )
    }
}
export type HistoryStates = ReadonlyMap<
    string,
    RecordedTransition<ReturnType<typeof selectHistoryState>>
>

export function historyStates(
    actions: readonly GameAction[],
    state: EighteenXXState
): HistoryStates {
    return new RecordedHistory(state, actions).select(selectHistoryState)
}
