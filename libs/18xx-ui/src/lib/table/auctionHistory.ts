import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import {
    isOfferAuctionLot,
    isBidOnAuctionLot,
    isPassAuction,
    isResolveAuction,
    type OfferAuctionLot,
    type BidOnAuctionLot,
    type PassAuction,
    type AuctionAward,
    type AuctionLot,
    type EighteenXXState
} from '@tabletop/18xx'

/** A lot that is a company takes the company's name; any other lot, such as a share, its own. */
export function auctionLotName(
    lotId: string,
    state: Pick<EighteenXXState, 'companies'>,
    lots: readonly AuctionLot[],
    companyName: (id: string) => string
): string {
    if (state.companies.some((company) => company.id === lotId)) return companyName(lotId)
    const lot = lots.find((lot) => lot.id === lotId)
    assertExists(lot, 'Recorded auction requires its lot')
    return lot.name
}

export type AuctionHistoryCard = {
    kind: 'auction'
    id: string
    offer: OfferAuctionLot
    events: (BidOnAuctionLot | PassAuction)[]
    resolution?: GameAction
    award?: AuctionAward
}
export type ActionHistoryEntry =
    AuctionHistoryCard | { kind: 'action'; id: string; action: GameAction }

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
