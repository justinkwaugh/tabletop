import * as Type from 'typebox'
import { AxialCoordinates, SimpleAuction, Visibility } from '@tabletop/common'
import { ActionSpaceId, CompanyId, Industry } from '../editions/types.js'

export type CompanyState = Type.Static<typeof CompanyState>
export const CompanyState = Type.Object({
    id: Type.Enum(CompanyId),
    treasury: Type.Number(),
    revenue: Type.Number(),
    // One entry per sold share, naming the player who holds it.
    owners: Type.Array(Type.String())
})

export type TrackHex = Type.Static<typeof TrackHex>
export const TrackHex = Type.Object({
    coords: AxialCoordinates,
    // Bottom to top: the top disc is the one that counts for the Railroad Bonus.
    discs: Type.Array(Type.Enum(CompanyId)),
    cube: Type.Optional(Type.Enum(CompanyId))
})

export type IndustryState = Type.Static<typeof IndustryState>
export const IndustryState = Type.Object({
    industry: Type.Enum(Industry),
    level: Type.Number(),
    // Tokens still in the Industry Development box, for sale through Industry Investment.
    available: Type.Number()
})

export type ActionSpaceState = Type.Static<typeof ActionSpaceState>
export const ActionSpaceState = Type.Object({
    id: Type.Enum(ActionSpaceId),
    // Times chosen since it was last emptied; its coin pile follows from this and the player count.
    selections: Type.Number()
})

export type InitialOffer = Type.Static<typeof InitialOffer>
export const InitialOffer = Type.Object({
    companyId: Type.Enum(CompanyId),
    industry: Type.Optional(Type.Enum(Industry)),
    startPlayer: Type.Boolean()
})

export enum ShareAuctionKind {
    Initial = 'Initial',
    Issue = 'Issue'
}

export type ShareAuction = Type.Static<typeof ShareAuction>
export const ShareAuction = Type.Object({
    kind: Type.Enum(ShareAuctionKind),
    companyId: Type.Enum(CompanyId),
    minimum: Type.Number(),
    industry: Type.Optional(Type.Enum(Industry)),
    startPlayer: Type.Boolean(),
    bidding: SimpleAuction
})

export type SealedBid = Type.Static<typeof SealedBid>
export const SealedBid = Type.Object({
    playerId: Type.String(),
    amount: Visibility.protect(Type.Number(), { policy: Visibility.Policy.Owner })
})

export type IndustryAuction = Type.Static<typeof IndustryAuction>
export const IndustryAuction = Type.Object({
    id: Type.String(),
    industry: Type.Enum(Industry),
    investorId: Type.String(),
    // The industry's newly raised Development Level, the lowest bid other than zero.
    minimum: Type.Number(),
    // Players whose sealed bid is still awaited.
    bidders: Type.Array(Type.String()),
    bids: Type.Array(SealedBid)
})
