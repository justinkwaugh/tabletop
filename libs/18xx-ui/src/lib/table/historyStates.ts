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
        bankBroken: !!state.bank.broken,
        ending: state.gameEnding ? { lastRound: lastOperatingRound(state) } : undefined,
        auction: !!(
            (state.offerAuction && !state.offerAuction.completed) ||
            (state.openingAuction && !state.openingAuction.completed) ||
            (state.selectionAuction && !state.selectionAuction.completed)
        )
    }
}
// A set's round count is fixed when it starts, so a later set's last round is not yet known.
function lastOperatingRound(state: Readonly<EighteenXXState>): string | undefined {
    const set = state.operatingSet
    return set && !set.completed && set.number === state.gameEnding?.finalOperatingSet
        ? `${set.number}.${set.roundCount}`
        : undefined
}
export type HistoryStates = ReadonlyMap<
    string,
    RecordedTransition<ReturnType<typeof selectHistoryState>>
>
export type HistoryBankBreak = { ending?: { lastRound?: string } }

export function historyBankBreaks(states: HistoryStates): ReadonlyMap<string, HistoryBankBreak> {
    const breaks = new Map<string, HistoryBankBreak>()
    let unscheduled: string | undefined
    for (const [id, { before, after }] of states) {
        if (after.bankBroken && !before?.bankBroken) {
            breaks.set(id, {})
            unscheduled = id
        }
        if (unscheduled && after.ending) {
            breaks.set(unscheduled, { ending: after.ending })
            unscheduled = undefined
        }
    }
    return breaks
}

export function historyStates(
    actions: readonly GameAction[],
    state: EighteenXXState
): HistoryStates {
    return new RecordedHistory(state, actions).select(selectHistoryState)
}
