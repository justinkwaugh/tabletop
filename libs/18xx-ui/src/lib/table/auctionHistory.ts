import { ActionSource, type GameAction } from '@tabletop/common'
import {
    isOfferAuctionLot,
    isBidOnAuctionLot,
    isPassAuction,
    isResolveAuction,
    type OfferAuctionLot,
    type BidOnAuctionLot,
    type PassAuction,
    type AuctionAward
} from '@tabletop/18xx'

export type AuctionHistoryCard = {
    kind: 'auction'
    id: string
    offer: OfferAuctionLot
    events: (BidOnAuctionLot | PassAuction)[]
    resolution?: GameAction
    award?: AuctionAward
}
export type ActionHistoryEntry =
    | AuctionHistoryCard
    | { kind: 'action'; id: string; action: GameAction }

export function auctionHistory(
    actions: readonly GameAction[],
    awards: readonly AuctionAward[]
): ActionHistoryEntry[] {
    const entries: ActionHistoryEntry[] = []
    let current: AuctionHistoryCard | undefined
    for (const action of actions) {
        if (isOfferAuctionLot(action)) {
            current = { kind: 'auction', id: action.id, offer: action, events: [] }
            entries.push(current)
        } else if (current && isBidOnAuctionLot(action) && action.lotId === current.offer.lotId) {
            current.events.push(action)
        } else if (current && isPassAuction(action)) {
            current.events.push(action)
        } else if (current && isResolveAuction(action)) {
            current.resolution = action
            current.award = awards.find((award) => award.lotId === current?.offer.lotId)
        } else if (action.source === ActionSource.User) {
            current = undefined
            entries.push({ kind: 'action', id: action.id, action })
        }
    }
    return entries.toReversed()
}
