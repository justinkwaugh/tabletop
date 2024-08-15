import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Auction, AuctionParticipant, AuctionType, HydratedAuction } from './auction.js'

export type SimpleAuction = Static<typeof SimpleAuction>
export const SimpleAuction = Type.Composite([
    Auction,
    Type.Object({
        type: Type.Literal(AuctionType.Simple)
    })
])

export const SimpleAuctionValidator = TypeCompiler.Compile(SimpleAuction)

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
