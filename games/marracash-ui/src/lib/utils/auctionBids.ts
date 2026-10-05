import type { AuctionResult, RevealedBid } from '@tabletop/marracash'

// Highest bid first. Bids are recorded clockwise from the auctioneer and the sort is stable,
// so equal bids stay in that order, which is also the order that breaks a tie.
export function bidsInTableOrder(result: AuctionResult): RevealedBid[] {
    return result.bids.toSorted((a, b) => b.amount - a.amount)
}
