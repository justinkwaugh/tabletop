import * as Type from 'typebox'
import { SimpleAuction } from '@tabletop/common'
import { RailroadId } from '../maps/types.js'

export enum AuctionKind {
    InitialOffering = 'InitialOffering',
    RailroadOpening = 'RailroadOpening',
    OfferStock = 'OfferStock'
}

export type ShareAuction = Type.Static<typeof ShareAuction>
export const ShareAuction = Type.Object({
    kind: Type.Enum(AuctionKind),
    railroadId: Type.Enum(RailroadId),
    // The player offering one of their own shares; absent when the share comes from the railroad.
    sellerId: Type.Optional(Type.String()),
    minimum: Type.Number(),
    bidding: SimpleAuction
})

// Initial and opening offerings hand the share to the opening bidder for free when nobody bids.
export function goesFreeToOpener(kind: AuctionKind): boolean {
    return kind !== AuctionKind.OfferStock
}
