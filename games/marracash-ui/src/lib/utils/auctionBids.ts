import type { AuctionResult, RevealedBid } from '@tabletop/marracash'

// Highest bid first; equal bids keep seating order, so a tie is shown without singling anyone out.
export function bidsInTableOrder(
    result: AuctionResult,
    seatingOrder: readonly string[]
): RevealedBid[] {
    const seat = (bid: RevealedBid) => seatingOrder.indexOf(bid.playerId)
    return result.bids.toSorted((a, b) => b.amount - a.amount || seat(a) - seat(b))
}
