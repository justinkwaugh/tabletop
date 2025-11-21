import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { Auction, AuctionParticipant, AuctionType, HydratedAuction } from './auction.js'

export type SimpleAuction = Static<typeof SimpleAuction>
export const SimpleAuction = Type.Evaluate(
    Type.Intersect([
        Auction,
        Type.Object({
            type: Type.Literal(AuctionType.Simple)
        })
    ])
)

export const SimpleAuctionValidator = Compile(SimpleAuction)

export class HydratedSimpleAuction
    extends HydratedAuction<typeof SimpleAuction>
    implements SimpleAuction
{
    declare type: AuctionType.Simple

    constructor(data: SimpleAuction) {
        super(data, SimpleAuctionValidator)
    }

    override validateBid(participant: AuctionParticipant, amount: number) {
        if (participant.passed) {
            throw Error(`Player ${participant.playerId} has already passed`)
        }
        if (participant.bid !== undefined && amount <= participant.bid) {
            throw Error(`Player ${participant.playerId} must increase the bid amount`)
        }
    }

    override validatePass(participant: AuctionParticipant) {
        if (participant.passed) {
            throw Error(`Player ${participant.playerId} has already passed`)
        }
    }
}
