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
    isResolveSelectionAuction,
    isStartOperatingRound,
    isSetStockInstruction,
    isStopStockInstruction,
    isSetPrivatePowerRequest,
    isDropPrivatePowerRequest,
    isExportTrains,
    isPayInterest,
    type EighteenXXState,
    type AuctionAward
} from '@tabletop/18xx'
import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import { historyOperatingOrder, type HistoryOperatingOrder } from './historyOperatingOrder.js'
import { historyCash, changedCompanyCash, type HistoryCash } from './historyCash.js'
import { auctionHistory, type ActionHistoryEntry } from './auctionHistory.js'
import type { TitleRound } from '../session/titlePresentation.js'

export type HistoryRound = {
    id: string
    label: string
    title: string
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
    cash: ReadonlyMap<string, HistoryCash> = historyCash(actions, state),
    titleEvent: (action: GameAction) => boolean = () => false,
    titleRound?: TitleRound
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
        (state.openingAuction && !state.openingAuction.completed) ||
        (state.selectionAuction && !state.selectionAuction.completed)
    )
    // Walking back from the end, the title's round is open between its end and its start.
    let titleRoundOpen = !!titleRound?.inProgress(state)
    const rounds: HistoryRound[] = []
    for (const action of actions.toReversed()) {
        if (titleRound?.ends(action)) titleRoundOpen = true
        const [abbreviation, name, number] = auction
            ? ['Auction', 'Auction', '']
            : titleRound && titleRoundOpen
              ? [titleRound.abbreviation, titleRound.name, `${set}.${round}`]
              : operating && !isCompleteStockRound(action)
                ? ['OR', 'Operating round', `${set}.${round}`]
                : ['SR', 'Stock round', `${stock}`]
        const label = number ? `${abbreviation} ${number}` : abbreviation
        if (titleRound?.starts(action)) titleRoundOpen = false
        let section = rounds.at(-1)
        if (section?.id !== label) {
            section = {
                id: label,
                label,
                title: number ? `${name} ${number}` : name,
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
            startsOperatingRound ||
            isSetStockInstruction(action) ||
            isStopStockInstruction(action) ||
            isSetPrivatePowerRequest(action) ||
            isDropPrivatePowerRequest(action)
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
                  isExportTrains(action) ||
                  isPayInterest(action) ||
                  titleEvent(action) ||
                  (isResolveAuction(action) && !state.offerAuction) ||
                  isResolveSelectionAuction(action)
                      ? { kind: 'action' as const, id: action.id, action }
                      : undefined))
        if (entry) section.entries.push(entry)
        if (isResolveSelectionAuction(action) && action.metadata?.completed) auction = true
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
