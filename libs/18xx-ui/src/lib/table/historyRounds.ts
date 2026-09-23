import {
    isAdvancePhase,
    isBuyShares,
    isCompleteStockRound,
    isRunTrains,
    isDistributeEarnings,
    isFinishStockTurn,
    isFloatCompany,
    isEndGame,
    isResolveAuction,
    isStartOperatingRound,
    isSetStockInstruction,
    isStopStockInstruction,
    type EighteenXXState,
    type AuctionAward
} from '@tabletop/18xx'
import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import { historyOperatingOrder, type HistoryOperatingOrder } from './historyOperatingOrder.js'
import { historyCash, changedCompanyCash, type HistoryCash } from './historyCash.js'
import { auctionHistory, type ActionHistoryEntry } from './auctionHistory.js'

export type HistoryRound = {
    id: string
    label: string
    phases: string[]
    startActionIndex?: number
    endActionIndex?: number
    operatingOrder?: HistoryOperatingOrder
    entries: ActionHistoryEntry[]
}

function changedCompanyCashOf(cash: HistoryCash | undefined): boolean {
    return cash !== undefined && changedCompanyCash(cash)
}

export function historyRounds(
    actions: readonly GameAction[],
    state: EighteenXXState,
    orderChanges: ReadonlyMap<string, HistoryOperatingOrder> = historyOperatingOrder(
        actions,
        state
    ),
    cash: ReadonlyMap<string, HistoryCash> = historyCash(actions, state)
): HistoryRound[] {
    const awards: readonly AuctionAward[] = state.offerAuction?.awards ?? []
    const entries = new Map(auctionHistory(actions, awards).map((entry) => [entry.id, entry]))
    let phase = state.phaseId
    let stock = state.stockRound.number
    let operating = state.stockRound.completed
    let set = state.operatingSet?.number ?? 1
    let round = state.operatingSet?.roundNumber ?? 1
    let auction = !!(
        (state.offerAuction && !state.offerAuction.completed) ||
        (state.openingAuction && !state.openingAuction.completed)
    )
    const rounds: HistoryRound[] = []
    for (const action of actions.toReversed()) {
        const label = auction
            ? 'Auction'
            : operating && !isCompleteStockRound(action)
              ? `OR ${set}.${round}`
              : `SR ${stock}`
        let section = rounds.at(-1)
        if (section?.id !== label) {
            section = {
                id: label,
                label,
                phases: [phase],
                endActionIndex: action.index,
                entries: []
            }
            rounds.push(section)
        }
        section.startActionIndex = action.index
        if (section.phases[0] !== phase) section.phases.unshift(phase)
        const startsOperatingRound = isStartOperatingRound(action)
        if (startsOperatingRound) {
            const order = orderChanges.get(action.id)
            assertExists(order, 'Operating round history requires its recorded company order')
            section.operatingOrder = order
        }
        const entry =
            startsOperatingRound || isSetStockInstruction(action) || isStopStockInstruction(action)
                ? undefined
                : (entries.get(action.id) ??
                  (orderChanges.has(action.id) ||
                  changedCompanyCashOf(cash.get(action.id)) ||
                  isRunTrains(action) ||
                  isDistributeEarnings(action) ||
                  isAdvancePhase(action) ||
                  isFinishStockTurn(action) ||
                  (isBuyShares(action) && action.source === ActionSource.System) ||
                  isFloatCompany(action) ||
                  (isCompleteStockRound(action) &&
                      action.metadata?.marketMoves.some(
                          (move) => move.fromMarketSpaceId !== move.toMarketSpaceId
                      )) ||
                  isEndGame(action) ||
                  (isResolveAuction(action) && !state.offerAuction)
                      ? { kind: 'action' as const, id: action.id, action }
                      : undefined))
        if (entry) section.entries.push(entry)
        for (const patch of action.undoPatch ?? []) {
            if (patch.op !== 'add' && patch.op !== 'replace') continue
            if (patch.path === '/phaseId') {
                phase = patch.value
                section.startActionIndex = action.index
                if (section.phases[0] !== phase) section.phases.unshift(phase)
            } else if (patch.path === '/stockRound') {
                stock = patch.value.number
                operating = patch.value.completed
            } else if (patch.path === '/stockRound/number') stock = patch.value
            else if (patch.path === '/stockRound/completed') operating = patch.value
            else if (patch.path === '/operatingSet') {
                set = patch.value.number
                round = patch.value.roundNumber
            } else if (patch.path === '/operatingSet/number') set = patch.value
            else if (patch.path === '/operatingSet/roundNumber') round = patch.value
            else if (
                patch.path === '/offerAuction/completed' ||
                patch.path === '/openingAuction/completed'
            )
                auction = !patch.value
        }
    }
    return rounds.filter(
        (section) => section.entries.length > 0 || section.operatingOrder !== undefined
    )
}
