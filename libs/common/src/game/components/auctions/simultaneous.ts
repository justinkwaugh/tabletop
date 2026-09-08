import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Auction, AuctionParticipant, AuctionType, HydratedAuction } from './auction.js'
import { findLast } from '../../../util/findLast.js'
import { protect, scope } from '../../visibility/visibilitySchema.js'

export enum TieResolutionStrategy {
    FirstInOrder,
    LastInOrder
}

export const SimultaneousAuctionVisibility = {
    Scope: 'tabletop.auction.simultaneous',
    Policy: {
        Bid: 'tabletop.auction.simultaneous.bid'
    }
} as const

export type SimultaneousAuctionParticipant = Type.Static<typeof SimultaneousAuctionParticipant>
export const SimultaneousAuctionParticipant = Type.Evaluate(
    Type.Intersect([
        Type.Omit(AuctionParticipant, ['bid']),
        Type.Object({
            bid: protect(AuctionParticipant.properties.bid, {
                policy: SimultaneousAuctionVisibility.Policy.Bid
            }),
            submitted: Type.Optional(Type.Boolean())
        })
    ])
)

export type SimultaneousAuction = Type.Static<typeof SimultaneousAuction>
export const SimultaneousAuction = scope(
    Type.Evaluate(
        Type.Intersect([
            Type.Omit(Auction, ['participants']),
            Type.Object({
                type: Type.Literal(AuctionType.Simultaneous),
                participants: Type.Array(SimultaneousAuctionParticipant),
                tie: Type.Boolean(),
                tieResolution: Type.Enum(TieResolutionStrategy)
            })
        ])
    ),
    SimultaneousAuctionVisibility.Scope
)

export const SimultaneousAuctionValidator = Compile(SimultaneousAuction)

export function isSimultaneousAuctionResolved(auction: SimultaneousAuction): boolean {
    return auction.winnerId !== undefined
}

export class HydratedSimultaneousAuction
    extends HydratedAuction<typeof SimultaneousAuction>
    implements SimultaneousAuction
{
    declare type: AuctionType.Simultaneous
    declare participants: SimultaneousAuctionParticipant[]
    declare tie: boolean
    declare tieResolution: TieResolutionStrategy

    constructor(data: SimultaneousAuction) {
        super(data, SimultaneousAuctionValidator)
    }

    override findParticipant(playerId: string): SimultaneousAuctionParticipant {
        return super.findParticipant(playerId)
    }

    override validateBid(participant: AuctionParticipant, _amount: number) {
        if (participant.bid !== undefined) {
            throw Error(`Player ${participant.playerId} may not bid twice`)
        }
    }

    override placeBid(playerId: string, amount: number): void {
        const participant = this.findParticipant(playerId)
        super.placeBid(playerId, amount)
        participant.submitted = true

        if (this.allBidsSubmitted()) {
            this.calculateWinner()
        }
    }

    allBidsSubmitted(): boolean {
        return this.participants.every(
            (participant) => participant.submitted ?? participant.bid !== undefined
        )
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
