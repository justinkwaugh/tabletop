import type { GameAction } from '@tabletop/common'
import { ActionType, isPlaceTurnOrderBid } from '@tabletop/indonesia'

type TurnOrderBidAction = GameAction & {
    type: ActionType.PlaceTurnOrderBid
    playerId: string
    amount: number
    index?: number
    metadata?: {
        multipliedAmount?: number
    }
}

export type TurnOrderBidSummaryEntry = {
    id: string
    playerId: string
    bidAction: TurnOrderBidAction
    total: number
    firstBidIndex: number
    firstBidOrder: number
}

function turnOrderBidTotal(action: TurnOrderBidAction): number {
    return action.metadata?.multipliedAmount ?? action.amount
}

export function summarizeConsecutiveTurnOrderBids(
    actions: GameAction[],
    lastBidActionIndex: number
): TurnOrderBidSummaryEntry[] {
    const lastActionPosition = actions.findLastIndex(
        (candidate) => candidate.index === lastBidActionIndex && isPlaceTurnOrderBid(candidate)
    )
    if (lastActionPosition === -1) {
        return []
    }

    const consecutiveBidActions: TurnOrderBidAction[] = []
    for (let position = lastActionPosition; position >= 0; position -= 1) {
        const candidate = actions[position]
        if (!isPlaceTurnOrderBid(candidate)) {
            break
        }
        consecutiveBidActions.unshift(candidate as TurnOrderBidAction)
    }

    const summaryByPlayerId = new Map<string, TurnOrderBidSummaryEntry>()

    for (const [order, bidAction] of consecutiveBidActions.entries()) {
        const existing = summaryByPlayerId.get(bidAction.playerId)
        const total = turnOrderBidTotal(bidAction)
        const firstBidIndex = bidAction.index ?? Number.MAX_SAFE_INTEGER

        if (!existing) {
            summaryByPlayerId.set(bidAction.playerId, {
                id: `${bidAction.playerId}:${firstBidIndex}`,
                playerId: bidAction.playerId,
                bidAction,
                total,
                firstBidIndex,
                firstBidOrder: order
            })
            continue
        }

        if (total > existing.total) {
            existing.bidAction = bidAction
            existing.total = total
        }
    }

    return Array.from(summaryByPlayerId.values()).sort((entryA, entryB) => {
        if (entryB.total !== entryA.total) {
            return entryB.total - entryA.total
        }
        if (entryA.firstBidIndex !== entryB.firstBidIndex) {
            return entryA.firstBidIndex - entryB.firstBidIndex
        }
        return entryA.firstBidOrder - entryB.firstBidOrder
    })
}
