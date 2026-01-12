import {
    AuctionType,
    Hydratable,
    HydratedSimultaneousAuction,
    SimultaneousAuction,
    TieResolutionStrategy
} from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { ContainerColor } from '../model/container.js'

export type ForeignIslandAuction = Static<typeof ForeignIslandAuction>
export const ForeignIslandAuction = Type.Object({
    sellerId: Type.String(),
    containers: Type.Array(Type.Enum(ContainerColor)),
    phase: Type.Union([
        Type.Literal('initial'),
        Type.Literal('tiebreak'),
        Type.Literal('select_winner')
    ]),
    round: SimultaneousAuction,
    totalBids: Type.Record(Type.String(), Type.Number()),
    winningBid: Type.Optional(Type.Number()),
    winningBidderId: Type.Optional(Type.String()),
    tiedPlayerIds: Type.Optional(Type.Array(Type.String()))
})

export const ForeignIslandAuctionValidator = Compile(ForeignIslandAuction)

export class HydratedForeignIslandAuction
    extends Hydratable<typeof ForeignIslandAuction>
    implements ForeignIslandAuction
{
    declare sellerId: string
    declare containers: ContainerColor[]
    declare phase: 'initial' | 'tiebreak' | 'select_winner'
    declare round: HydratedSimultaneousAuction
    declare totalBids: Record<string, number>
    declare winningBid?: number
    declare winningBidderId?: string
    declare tiedPlayerIds?: string[]

    constructor(data: ForeignIslandAuction) {
        super(data, ForeignIslandAuctionValidator)
        this.round = new HydratedSimultaneousAuction(data.round)
    }

    static createRound(participantIds: string[], auctioneerId: string, id: string) {
        return new HydratedSimultaneousAuction({
            id,
            type: AuctionType.Simultaneous,
            participants: participantIds.map((playerId) => ({ playerId, passed: false })),
            auctioneerId,
            tie: false,
            tieResolution: TieResolutionStrategy.FirstInOrder
        })
    }

    placeBid(playerId: string, amount: number) {
        const currentTotal = this.totalBids[playerId] ?? 0
        const newTotal = this.phase === 'tiebreak' ? currentTotal + amount : amount
        this.round.placeBid(playerId, newTotal)
        this.totalBids[playerId] = newTotal
    }

    isRoundComplete(): boolean {
        return this.round.participants.every((participant) => participant.bid !== undefined)
    }

    resolveRound(): 'tiebreak' | 'select_winner' | 'resolved' {
        const highBid = this.round.highBid ?? 0
        const tiedPlayerIds = this.round.participants
            .filter((participant) => participant.bid === highBid)
            .map((participant) => participant.playerId)

        if (!this.round.tie) {
            this.winningBid = highBid
            this.winningBidderId = this.round.winnerId
            this.tiedPlayerIds = undefined
            return 'resolved'
        }

        if (this.phase === 'initial') {
            this.phase = 'tiebreak'
            this.tiedPlayerIds = tiedPlayerIds
            this.round = HydratedForeignIslandAuction.createRound(
                tiedPlayerIds,
                this.sellerId,
                this.round.id
            )
            return 'tiebreak'
        }

        this.phase = 'select_winner'
        this.tiedPlayerIds = tiedPlayerIds
        this.winningBid = highBid
        this.winningBidderId = undefined
        return 'select_winner'
    }
}
