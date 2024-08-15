import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Auction, AuctionParticipant, AuctionType, HydratedAuction } from './auction.js'
import { findLast } from '../../../util/findLast.js'

export enum TieResolutionStrategy {
    FirstInOrder,
    LastInOrder
}

export type SimultaneousAuction = Static<typeof SimultaneousAuction>
export const SimultaneousAuction = Type.Composite([
    Auction,
    Type.Object({
        type: Type.Literal(AuctionType.Simultaneous),
        tie: Type.Boolean(),
        tieResolution: Type.Enum(TieResolutionStrategy)
    })
])

export const SimultaneousAuctionValidator = TypeCompiler.Compile(SimultaneousAuction)

export class HydratedSimultaneousAuction
    extends HydratedAuction<typeof SimultaneousAuction>
    implements SimultaneousAuction
{
    declare type: AuctionType.Simultaneous
    declare tie: boolean
    declare tieResolution: TieResolutionStrategy

    constructor(data: SimultaneousAuction) {
        super(data, SimultaneousAuctionValidator)
    }

    override validateBid(participant: AuctionParticipant, _amount: number) {
        if (participant.bid !== undefined) {
            throw Error(`Player ${participant.playerId} may not bid twice`)
        }
    }

    override placeBid(playerId: string, amount: number): void {
        super.placeBid(playerId, amount)

        if (
            this.participants.every((participant) => {
                return participant.bid !== undefined
            })
        ) {
            this.calculateWinner()
        }
    }

    override validatePass(_participant: AuctionParticipant) {
        throw Error(`Simultaneous auctions do not allow passing`)
    }

    private calculateWinner() {
        this.highBid = Math.max(...this.participants.map((participant) => participant.bid ?? 0))
        const highBidPlayers = this.participants.filter(
            (participant) => participant.bid === this.highBid
        )
        if (highBidPlayers.length === 1) {
            this.tie = false
            this.winnerId = highBidPlayers[0].playerId
        } else {
            this.tie = true
            // First double the array so we don't have to consider wrapping
            const extendedOrder = this.participants.concat(this.participants)
            switch (this.tieResolution) {
                case TieResolutionStrategy.FirstInOrder: {
                    const winner = extendedOrder.find(
                        (participant) => participant.bid === this.highBid
                    )
                    this.winnerId = winner?.playerId
                    break
                }
                case TieResolutionStrategy.LastInOrder: {
                    const winner = findLast(
                        extendedOrder,
                        (participant) => participant.bid === this.highBid
                    )
                    this.winnerId = winner?.playerId
                    break
                }
            }
        }
    }
}
