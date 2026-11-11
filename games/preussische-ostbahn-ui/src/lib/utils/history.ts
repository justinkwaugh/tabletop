import { isCallGameAction, type GameAction } from '@tabletop/common'
import {
    isAwardShare,
    isCapitalize,
    isDeterminePlayerOrder,
    isBuildTrack,
    isCompleteExpansion,
    isEndExpansion,
    isPassBid,
    isPassTurn,
    isPayDividends,
    isPlaceBid,
    RAILROAD_IDS,
    type RailroadId
} from '@tabletop/preussische-ostbahn'
import { actionSale } from './describeAction.js'

export type HistoryAuction = {
    kind: 'auction'
    key: string
    railroadId: RailroadId
    actions: GameAction[]
}

export type HistoryTurn = {
    kind: 'turn'
    key: string
    playerId: string
    actions: GameAction[]
    closed: boolean
}

export type HistoryRound = {
    kind: 'round'
    key: string
    round: number
    action: GameAction
}

export type HistoryCall = {
    kind: 'call'
    key: string
    action: GameAction
}

export type HistoryDividends = {
    kind: 'dividends'
    key: string
    action: GameAction
}

export type HistoryEntry =
    HistoryAuction | HistoryTurn | HistoryRound | HistoryCall | HistoryDividends

function closesTurn(action: GameAction): boolean {
    return (
        isEndExpansion(action) ||
        isCompleteExpansion(action) ||
        isPassTurn(action) ||
        actionSale(action) !== undefined
    )
}

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    let auction: HistoryAuction | undefined
    let turn: HistoryTurn | undefined
    let round = 0
    let openingSales = 0
    for (const action of actions) {
        if (isCallGameAction(action)) {
            entries.push({ kind: 'call', key: action.id, action })
            continue
        }
        if (isPayDividends(action)) {
            entries.push({ kind: 'dividends', key: action.id, action })
            continue
        }
        if (isDeterminePlayerOrder(action)) {
            round += action.metadata?.endReason ? 0 : 1
            entries.push({ kind: 'round', key: action.id, round, action })
            auction = undefined
            turn = undefined
            continue
        }
        if (round === 0 && (isPlaceBid(action) || isPassBid(action) || isAwardShare(action))) {
            if (!auction) {
                const railroadId = RAILROAD_IDS[openingSales]
                auction = { kind: 'auction', key: action.id, railroadId, actions: [] }
                entries.push(auction)
            }
            auction.actions.push(action)
            const sale = actionSale(action)
            if (sale) {
                auction.railroadId = sale.railroadId
                openingSales += 1
                auction = undefined
            }
            continue
        }
        const startsTurn = isCapitalize(action) || isBuildTrack(action) || isPassTurn(action)
        if (startsTurn && action.playerId && (!turn || turn.closed)) {
            turn = {
                kind: 'turn',
                key: action.id,
                playerId: action.playerId,
                actions: [],
                closed: false
            }
            entries.push(turn)
        }
        if (
            turn &&
            (startsTurn ||
                isPlaceBid(action) ||
                isPassBid(action) ||
                isEndExpansion(action) ||
                isCompleteExpansion(action))
        ) {
            turn.actions.push(action)
            turn.closed = turn.closed || closesTurn(action)
        }
    }
    return entries
}
