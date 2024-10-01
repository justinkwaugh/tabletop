import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Auction, AuctionParticipant, AuctionType, HydratedAuction } from './auction.js'

export type OnceAroundAuction = Static<typeof OnceAroundAuction>
export const OnceAroundAuction = Type.Composite([
    Auction,
    Type.Object({
        type: Type.Literal(AuctionType.OnceAround)
    })
])

export const OnceAroundAuctionValidator = TypeCompiler.Compile(OnceAroundAuction)

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

        if (this.isAuctionComplete() && this.highBid !== undefined) {
            const winner = this.participants.find((participant) => participant.bid === this.highBid)
            if (winner === undefined) {
                throw Error('Cannot find winner')
            }
            this.winnerId = winner.playerId
        }
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
}
