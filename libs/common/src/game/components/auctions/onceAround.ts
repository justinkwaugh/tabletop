import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { Auction, AuctionParticipant, AuctionType, HydratedAuction } from './auction.js'

export type OnceAroundAuction = Static<typeof OnceAroundAuction>
export const OnceAroundAuction = Type.Evaluate(
    Type.Intersect([
        Auction,
        Type.Object({
            type: Type.Literal(AuctionType.OnceAround)
        })
    ])
)

export const OnceAroundAuctionValidator = Compile(OnceAroundAuction)

export class HydratedOnceAroundAuction
    extends HydratedAuction<typeof OnceAroundAuction>
    implements OnceAroundAuction
{
    declare type: AuctionType.OnceAround

    constructor(data: OnceAroundAuction) {
        super(data, OnceAroundAuctionValidator)
    }

    override validateBid(participant: AuctionParticipant, _amount: number) {
        if (participant.bid !== undefined) {
            throw Error(`Player ${participant.playerId} may not bid twice`)
        }
    }

    override placeBid(playerId: string, amount: number): void {
        super.placeBid(playerId, amount)

        if (amount > (this.highBid ?? 0)) {
            this.highBid = amount
        }

        this.checkAuctionComplete()
    }

    override pass(playerId: string): void {
        super.pass(playerId)

        this.checkAuctionComplete()
    }

    isAuctionComplete() {
        return this.participants.every(
            (participant) => participant.bid !== undefined || participant.passed
        )
    }

    nextBidder(): string | undefined {
        return this.participants.find(
            (participant) => participant.bid === undefined && !participant.passed
        )?.playerId
    }

    private checkAuctionComplete() {
        if (this.isAuctionComplete() && this.highBid !== undefined) {
            const winner = this.participants.find((participant) => participant.bid === this.highBid)
            if (winner === undefined) {
                throw Error('Cannot find winner')
            }
            this.winnerId = winner.playerId
        }
    }
}
