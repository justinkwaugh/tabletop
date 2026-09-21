import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { OpeningAuctionRules } from './auctionProcedure.js'
import type { OfferPileAuctionRules } from './offerPileAuction.js'
import type { WaterfallAuctionRules } from './waterfallAuction.js'
import { OfferAuctionLot, HydratedOfferAuctionLot, isOfferAuctionLot } from './offerAuctionLot.js'
import { BidOnAuctionLot, HydratedBidOnAuctionLot, isBidOnAuctionLot } from './bidOnAuctionLot.js'
import { ReserveBid, HydratedReserveBid, isReserveBid } from './reserveBid.js'
import { RaiseAuctionBid, HydratedRaiseAuctionBid, isRaiseAuctionBid } from './raiseAuctionBid.js'
import { BuyAuctionLot, HydratedBuyAuctionLot, isBuyAuctionLot } from './buyAuctionLot.js'
import { PassAuction, HydratedPassAuction, isPassAuction } from './passAuction.js'
import { ResolveAuction, HydratedResolveAuction, isResolveAuction } from './resolveAuction.js'

function sharedAuctionActions(rules: OpeningAuctionRules): ActionDefinition[] {
    return [
        defineAction(
            PassAuction,
            isPassAuction,
            (action) => new HydratedPassAuction(action, rules)
        ),
        defineAction(
            ResolveAuction,
            isResolveAuction,
            (action) => new HydratedResolveAuction(action, rules)
        )
    ]
}
function offerAuctionActions(rules: OfferPileAuctionRules): ActionDefinition[] {
    return [
        defineAction(
            OfferAuctionLot,
            isOfferAuctionLot,
            (action) => new HydratedOfferAuctionLot(action, rules)
        ),
        defineAction(
            BidOnAuctionLot,
            isBidOnAuctionLot,
            (action) => new HydratedBidOnAuctionLot(action, rules)
        )
    ]
}
function waterfallAuctionActions(rules: WaterfallAuctionRules): ActionDefinition[] {
    return [
        defineAction(ReserveBid, isReserveBid, (action) => new HydratedReserveBid(action, rules)),
        defineAction(
            RaiseAuctionBid,
            isRaiseAuctionBid,
            (action) => new HydratedRaiseAuctionBid(action, rules)
        ),
        defineAction(
            BuyAuctionLot,
            isBuyAuctionLot,
            (action) => new HydratedBuyAuctionLot(action, rules)
        )
    ]
}
export function auctionActions(
    offer: OfferPileAuctionRules | undefined,
    waterfall: WaterfallAuctionRules | undefined
): ActionDefinition[] {
    const shared = offer ?? waterfall
    return [
        ...(offer ? offerAuctionActions(offer) : []),
        ...(waterfall ? waterfallAuctionActions(waterfall) : []),
        ...(shared ? sharedAuctionActions(shared) : [])
    ]
}
