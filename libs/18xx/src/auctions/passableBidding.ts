import {
    AuctionType,
    HydratedSimpleAuction,
    assert,
    assertExists,
    type SimpleAuction
} from '@tabletop/common'

export type BiddingWinner = { playerId: string; amount: number }

/**
 * Bidding on one lot in which each player, in seat order after the high bidder, raises or
 * passes; a pass withdraws the player, and the last bidder left wins.
 */
export class PassableBidding {
    constructor(private readonly bidding: SimpleAuction) {}

    static open(
        id: string,
        seatOrder: readonly string[],
        openerId: string,
        amount: number
    ): SimpleAuction {
        assert(seatOrder.includes(openerId), 'The opening bidder must take part')
        return {
            id,
            type: AuctionType.Simple,
            auctioneerId: openerId,
            highBid: amount,
            participants: seatOrder.map((playerId) => ({
                playerId,
                passed: false,
                ...(playerId === openerId ? { bid: amount } : {})
            }))
        }
    }

    get highBid(): number {
        assertExists(this.bidding.highBid, 'Bidding requires an opening bid')
        return this.bidding.highBid
    }

    get highBidderId(): string {
        const bidder = this.bidding.participants.find(
            (participant) => !participant.passed && participant.bid === this.highBid
        )
        assertExists(bidder, 'Bidding requires a high bidder')
        return bidder.playerId
    }

    get remainingPlayerIds(): string[] {
        return this.bidding.participants
            .filter((participant) => !participant.passed)
            .map((participant) => participant.playerId)
    }

    get winner(): BiddingWinner | undefined {
        const remaining = this.remainingPlayerIds
        return remaining.length === 1 ? { playerId: remaining[0], amount: this.highBid } : undefined
    }

    get currentBidderId(): string | undefined {
        if (this.winner) return undefined
        const participants = this.bidding.participants
        const high = participants.findIndex((p) => p.playerId === this.highBidderId)
        for (let offset = 1; offset < participants.length; offset++) {
            const next = participants[(high + offset) % participants.length]
            if (!next.passed) return next.playerId
        }
        return undefined
    }

    bid(playerId: string, amount: number): SimpleAuction {
        assert(playerId === this.currentBidderId, 'It is not this player’s bid')
        const auction = new HydratedSimpleAuction(this.bidding)
        auction.placeBid(playerId, amount)
        auction.highBid = amount
        return auction.dehydrate()
    }

    pass(playerId: string): SimpleAuction {
        assert(playerId === this.currentBidderId, 'It is not this player’s bid')
        const auction = new HydratedSimpleAuction(this.bidding)
        auction.pass(playerId)
        return auction.dehydrate()
    }

    /** Withdraws every player other than the high bidder who cannot reach the minimum bid. */
    withdrawUnable(canReach: (playerId: string) => boolean): SimpleAuction {
        const auction = new HydratedSimpleAuction(this.bidding)
        for (const playerId of this.remainingPlayerIds)
            if (playerId !== this.highBidderId && !canReach(playerId)) auction.pass(playerId)
        return auction.dehydrate()
    }
}

export function validBidStep(amount: number, minimum: number, increment: number): boolean {
    return Number.isSafeInteger(amount) && amount >= minimum && (amount - minimum) % increment === 0
}
