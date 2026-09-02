import { AuctionParticipant, SimultaneousAuction, Visibility } from '@tabletop/common'
import * as Type from 'typebox'
import { FreshFishVisibilityPolicy } from '../definition/visibility.js'

export type FreshFishAuctionParticipant = Type.Static<typeof FreshFishAuctionParticipant>
export const FreshFishAuctionParticipant = Type.Object({
    ...AuctionParticipant.properties,
    bid: Visibility.protect(AuctionParticipant.properties.bid, {
        policy: FreshFishVisibilityPolicy.SealedBid
    })
})

export type FreshFishSimultaneousAuction = Type.Static<typeof FreshFishSimultaneousAuction>
export const FreshFishSimultaneousAuction = Type.Object({
    ...SimultaneousAuction.properties,
    participants: Type.Array(FreshFishAuctionParticipant)
})

export type FreshFishSimultaneousAuctionProjection = Type.Static<
    typeof FreshFishSimultaneousAuctionProjection
>
export const FreshFishSimultaneousAuctionProjection = Visibility.createProjectionSchema(
    FreshFishSimultaneousAuction
)
