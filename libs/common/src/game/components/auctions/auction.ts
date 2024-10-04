import { Type, type Static, type TSchema } from '@sinclair/typebox'
import { Hydratable } from '../../../util/hydration.js'
import { range } from '../../../util/range.js'

export enum AuctionType {
    Simple = 'simple',
    OnceAround = 'once-around',
    Simultaneous = 'simultaneous'
}

export type AuctionParticipant = Static<typeof AuctionParticipant>
export const AuctionParticipant = Type.Object({
    playerId: Type.String(),
    bid: Type.Optional(Type.Number()),
    passed: Type.Boolean({ default: false })
})

export type Auction = Static<typeof Auction>
export const Auction = Type.Object({
    id: Type.String(),
    type: Type.Enum(AuctionType),
    participants: Type.Array(AuctionParticipant),
    auctioneerId: Type.Optional(Type.String()),
    highBid: Type.Optional(Type.Number()),
    winnerId: Type.Optional(Type.String())
})

export abstract class HydratedAuction<T extends TSchema> extends Hydratable<T> implements Auction {
    declare id: string
    declare type: AuctionType
    declare participants: AuctionParticipant[]
    declare auctioneerId?: string
    declare highBid?: number
    declare winnerId?: string

    placeBid(playerId: string, amount: number) {
        const participant = this.findParticipant(playerId)
        this.validateBid(participant, amount)
        participant.bid = amount
    }

    validateBid(_participant: AuctionParticipant, _amount: number) {}

    pass(playerId: string) {
        const participant = this.findParticipant(playerId)
        this.validatePass(participant)
        participant.passed = true
    }

    validatePass(_participant: AuctionParticipant) {}

    findParticipant(playerId: string): AuctionParticipant {
        const participant = this.participants.find(
            (participant) => participant.playerId === playerId
        )
        if (participant === null || participant === undefined) {
            throw Error(`Cannot find auction participant for player with id ${playerId}`)
        }
        return participant
    }

    static generateBidOrder(turnOrder: string[], auctioneer: string): string[] {
        const doubledTurnOrder = turnOrder.concat(turnOrder) // So we don't have to worry about wrap
        const leftOfAuctioneerIndex = turnOrder.findIndex((playerId) => playerId === auctioneer) + 1
        return range(leftOfAuctioneerIndex, turnOrder.length).map(
            (index) => doubledTurnOrder[index]
        )
    }
}
