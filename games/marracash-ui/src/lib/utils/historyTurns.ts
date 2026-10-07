import type { GameAction } from '@tabletop/common'
import {
    getFountain,
    getShop,
    isBringVisitors,
    isCompleteAntiqueSet,
    isEndTurn,
    isMoveVisitors,
    isResolveAuction,
    isStartAuction,
    type AuctionResult,
    type BringVisitors,
    type CompleteAntiqueSet,
    type FountainId,
    type MarketColor,
    type MoveVisitors,
    type QueueEnd,
    type ShopId,
    type StartAuction
} from '@tabletop/marracash'
import { WallSide, wallSideOf } from '$lib/utils/boardGeometry.js'
import { movedVisitorColors, pulledInCustomers } from '$lib/utils/moneyReport.js'

export type Gate = 'north' | 'west' | 'south' | 'east'

const GateOfWallSide: Record<WallSide, Gate> = {
    [WallSide.Top]: 'north',
    [WallSide.Left]: 'west',
    [WallSide.Bottom]: 'south',
    [WallSide.Right]: 'east'
}

export type ShopVisit = {
    shopId: ShopId
    ownerId: string
    color: MarketColor
    customers: number
    moverIncome: number
}

export type TurnLine =
    | { kind: 'move'; action: MoveVisitors; colors: MarketColor[]; visits: ShopVisit[] }
    | { kind: 'bring'; action: BringVisitors; colors: MarketColor[]; end: QueueEnd; gate: Gate }
    | {
          kind: 'auction'
          action: StartAuction
          color: MarketColor
          result?: AuctionResult
          walkIns: { count: number; income: number }
          bidders: Bidder[]
      }
    | {
          kind: 'antiqueSet'
          action: CompleteAntiqueSet
          collectorId: string
          rank: number
          payout: number
      }

export type Bidder = { playerId: string; submitted: boolean }

export type OpenAuction = {
    shopId: ShopId
    bidding: { participants: readonly { playerId: string; submitted?: boolean }[] }
}

export function openBidders(auction: OpenAuction): Bidder[] {
    return auction.bidding.participants.map(({ playerId, submitted }) => ({
        playerId,
        submitted: submitted === true
    }))
}

export function entranceGate(entranceId: FountainId): Gate {
    return GateOfWallSide[wallSideOf(getFountain(entranceId).coords)]
}

export type PlayerIncome = { playerId: string; amount: number }

export type HistoryTurn = {
    kind: 'turn'
    id: string
    playerId: string
    round: number
    lines: TurnLine[]
    actions: GameAction[]
    // Where the turn's actions sit in the action list, for replaying it.
    firstIndex: number
    lastIndex: number
    moverNet: number
    others: PlayerIncome[]
    ended: boolean
}

export type HistoryRound = { kind: 'round'; id: string; round: number; final: boolean }

export type HistoryEntry = HistoryTurn | HistoryRound

// Every turn ends with an EndTurn, and seats take turns in a fixed order, so a turn's player and
// round follow from how many turns came before it. Rounds come newest first, each above its turns.
// An auction still open shows who has bid so far, from the auction in the state.
export function historyEntries(
    actions: readonly GameAction[],
    turnOrder: readonly string[],
    finalRound: boolean,
    openAuction?: OpenAuction
): HistoryEntry[] {
    const turns: HistoryTurn[] = []
    let pending: GameAction[] = []
    const close = (lastIndex: number, ended: boolean) => {
        const index = turns.length
        turns.push(
            historyTurn(
                pending,
                lastIndex,
                turnOrder[index % turnOrder.length],
                Math.floor(index / turnOrder.length) + 1,
                ended,
                openAuction
            )
        )
        pending = []
    }
    for (const [index, action] of actions.entries()) {
        pending.push(action)
        if (isEndTurn(action)) close(index, true)
    }
    if (pending.length > 0) close(actions.length - 1, false)

    const lastRound = turns.at(-1)?.round ?? 0
    const entries: HistoryEntry[] = []
    let round: number | undefined
    for (const turn of turns.toReversed()) {
        if (turn.round !== round) entries.push(roundMarker(turn.round))
        round = turn.round
        entries.push(turn)
    }
    return entries

    function roundMarker(round: number): HistoryRound {
        return {
            kind: 'round',
            id: `round-${round}`,
            round,
            final: finalRound && round === lastRound
        }
    }
}

type AuctionLine = Extract<TurnLine, { kind: 'auction' }>

function isAuctionLine(line: TurnLine): line is AuctionLine {
    return line.kind === 'auction'
}

// A turn holds at least its first action, and once ended, its EndTurn.
function historyTurn(
    actions: GameAction[],
    lastIndex: number,
    playerId: string,
    round: number,
    ended: boolean,
    openAuction?: OpenAuction
): HistoryTurn {
    const income = new Map<string, number>()
    const earn = (earnerId: string, amount: number) =>
        income.set(earnerId, (income.get(earnerId) ?? 0) + amount)

    const lines: TurnLine[] = []
    for (const action of actions) {
        if (isMoveVisitors(action) && action.metadata) {
            const visits = action.metadata.entries.map((entry): ShopVisit => {
                earn(entry.ownerId, entry.income - entry.moverCut)
                earn(action.playerId, entry.moverCut)
                return {
                    shopId: entry.shopId,
                    ownerId: entry.ownerId,
                    color: getShop(entry.shopId).color,
                    customers: entry.customers,
                    moverIncome: entry.ownerId === action.playerId ? entry.income : entry.moverCut
                }
            })
            lines.push({
                kind: 'move',
                action,
                colors: movedVisitorColors(action.metadata),
                visits
            })
        } else if (isBringVisitors(action) && action.metadata) {
            lines.push({
                kind: 'bring',
                action,
                colors: action.metadata.visitors,
                end: action.end,
                gate: entranceGate(action.entranceId)
            })
        } else if (isStartAuction(action)) {
            lines.push({
                kind: 'auction',
                action,
                color: getShop(action.shopId).color,
                walkIns: { count: 0, income: 0 },
                bidders: openAuction?.shopId === action.shopId ? openBidders(openAuction) : []
            })
        } else if (isResolveAuction(action) && action.metadata) {
            const result = action.metadata
            const auction = lines.findLast(isAuctionLine)
            if (!auction) continue
            const walkIns = pulledInCustomers(result)
            earn(result.winnerId, walkIns.income - result.price)
            earn(playerId, result.auctioneerCut)
            auction.result = result
            auction.walkIns = walkIns
            auction.bidders = []
        } else if (isCompleteAntiqueSet(action) && action.metadata) {
            earn(action.collectorId, action.metadata.payout)
            lines.push({
                kind: 'antiqueSet',
                action,
                collectorId: action.collectorId,
                rank: action.metadata.rank,
                payout: action.metadata.payout
            })
        }
    }

    return {
        kind: 'turn',
        id: actions[0].id,
        playerId,
        round,
        lines,
        actions,
        firstIndex: lastIndex - actions.length + 1,
        lastIndex,
        moverNet: income.get(playerId) ?? 0,
        others: [...income]
            .filter(([earnerId, amount]) => earnerId !== playerId && amount !== 0)
            .map(([earnerId, amount]) => ({ playerId: earnerId, amount })),
        ended
    }
}
