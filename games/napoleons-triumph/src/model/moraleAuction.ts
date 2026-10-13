import { AuctionType, type HydratedSimpleAuction, type SimpleAuction } from '@tabletop/common'
import { STARTING_MORALE } from '../components/pieces.js'
import { legal } from './legality.js'

/** Rule 17: a bid comes off the starting morale of the army chosen, which must be left with at least one point. */
export const MAX_BID = Math.max(...Object.values(STARTING_MORALE)) - 1

export function openMoraleAuction(bidderIds: readonly string[]): SimpleAuction {
    return {
        id: 'morale',
        type: AuctionType.Simple,
        participants: bidderIds.map((playerId) => ({ playerId, passed: false }))
    }
}

export function highBidderId(auction: SimpleAuction): string | undefined {
    return auction.participants.find(
        (participant) => participant.bid !== undefined && participant.bid === auction.highBid
    )?.playerId
}

/** Rule 17: the players take turns bidding, so the turn is with whoever does not hold the high bid. */
export function nextBidderId(auction: SimpleAuction): string | undefined {
    const leaderId = highBidderId(auction)
    return auction.participants.find((participant) => participant.playerId !== leaderId)?.playerId
}

/** Rule 17: a valid bid is greater than any previous bid. */
export function placeMoraleBid(auction: HydratedSimpleAuction, playerId: string, amount: number) {
    legal(
        amount <= MAX_BID && (auction.highBid === undefined || amount > auction.highBid),
        'A bid must beat the previous bid'
    )
    auction.placeBid(playerId, amount)
    auction.highBid = amount
}

/** Rule 17: the player who passes loses the auction to the other, at the bid that stands. */
export function passMoraleBid(auction: HydratedSimpleAuction, playerId: string) {
    auction.pass(playerId)
    auction.winnerId = auction.participants.find((participant) => !participant.passed)?.playerId
}

export function winningBid(auction: SimpleAuction): number {
    return auction.highBid ?? 0
}
