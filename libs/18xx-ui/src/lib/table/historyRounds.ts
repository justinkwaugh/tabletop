import { historyStates, type HistoryStates } from './historyStates.js'
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
import {
    AuctionHeading,
    operatingRoundHeading,
    titleStockRoundHeading,
    roundLabel,
    roundTitle,
    stockRoundHeading
} from './roundHeading.js'

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

export type HistoryTitle = {
    isEvent?: (action: GameAction) => boolean
    rounds?: readonly TitleRound[]
}

/** The game's end shares the round of the action before it, which may close a title's round. */
function roundClosingAction(reversed: readonly GameAction[], position: number): GameAction {
    const action = reversed[position]
    const closing = isEndGame(action) ? reversed[position + 1] : action
    assertExists(closing, 'The game ends after another action')
    return closing
}

export function historyRounds(
    actions: readonly GameAction[],
    state: EighteenXXState,
    states: HistoryStates = historyStates(actions, state),
    orderChanges: ReadonlyMap<string, HistoryOperatingOrder> = historyOperatingOrder(
        actions,
        states
    ),
    cash: ReadonlyMap<string, HistoryCash> = historyCash(states),
    title: HistoryTitle = {}
): HistoryRound[] {
    const titleRounds = title.rounds ?? []
    const awards: readonly AuctionAward[] = state.offerAuction?.awards ?? []
    const entries = new Map(auctionHistory(actions, awards).map((entry) => [entry.id, entry]))
    // Walking back from the end, a title's round is open between its end and its start.
    let openRound = titleRounds.find((round) => round.inProgress(state))
    const rounds: HistoryRound[] = []
    const reversed = actions.toReversed()
    for (const [position, action] of reversed.entries()) {
        const snapshot = states.get(action.id)
        if (!snapshot) continue
        const { phase, stock, operating, set, round, auction, setUnderWay } = snapshot.after
        const closing = roundClosingAction(reversed, position)
        openRound = titleRounds.find((round) => round.ends(closing)) ?? openRound
        const heading = auction
            ? AuctionHeading
            : openRound
              ? openRound.followsStockRound && !setUnderWay
                  ? titleStockRoundHeading(stock, openRound)
                  : operatingRoundHeading(set, round, openRound)
              : operating && !isCompleteStockRound(action)
                ? operatingRoundHeading(set, round)
                : stockRoundHeading(stock)
        const label = roundLabel(heading)
        if (openRound?.starts(action)) openRound = undefined
        let section = rounds.at(-1)
        if (section?.label !== label) {
            // A title's round held within an operating round splits it into two sections.
            const repeated = rounds.some((round) => round.label === label)
            section = {
                id: repeated ? `${label}@${action.index}` : label,
                label,
                title: roundTitle(heading),
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
        // A round's start is history only when privates paid companies, such as mail.
        const entry =
            (startsOperatingRound && !changedCompanyCashOf(cash.get(action.id))) ||
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
                  !!title.isEvent?.(action) ||
                  (isResolveAuction(action) && !state.offerAuction) ||
                  isResolveSelectionAuction(action)
                      ? { kind: 'action' as const, id: action.id, action }
                      : undefined))
        if (entry) section.entries.push(entry)
        const previousPhase = snapshot.before?.phase
        if (
            previousPhase !== undefined &&
            previousPhase !== phase &&
            section.phases[0] !== previousPhase
        )
            section.phases.unshift(previousPhase)
    }
    return rounds.filter(
        (section) => section.entries.length > 0 || section.operatingOrder !== undefined
    )
}
