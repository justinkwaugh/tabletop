import * as Type from 'typebox'
import { AxialCoordinates, SimpleAuction, Visibility } from '@tabletop/common'
import { ActionSpaceId, CompanyId, Industry, InvestmentItem } from '../editions/types.js'

export type CompanyState = Type.Static<typeof CompanyState>
export const CompanyState = Type.Object({
    id: Type.Enum(CompanyId),
    treasury: Type.Number(),
    revenue: Type.Number(),
    owners: Type.Array(Type.String()),
    loans: Type.Optional(Type.Number())
})

export type TrackHex = Type.Static<typeof TrackHex>
export const TrackHex = Type.Object({
    coords: AxialCoordinates,
    discs: Type.Array(Type.Enum(CompanyId)),
    cube: Type.Optional(Type.Enum(CompanyId))
})

export type IndustryState = Type.Static<typeof IndustryState>
export const IndustryState = Type.Object({
    industry: Type.Enum(Industry),
    level: Type.Number(),
    available: Type.Number()
})

export type ActionSpaceState = Type.Static<typeof ActionSpaceState>
export const ActionSpaceState = Type.Object({
    id: Type.Enum(ActionSpaceId),
    selections: Type.Number()
})

export type InitialOffer = Type.Static<typeof InitialOffer>
export const InitialOffer = Type.Object({
    companyId: Type.Enum(CompanyId),
    industry: Type.Optional(Type.Enum(Industry)),
    startPlayer: Type.Boolean(),
    bond: Type.Optional(Type.Boolean())
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
    bond: Type.Optional(Type.Boolean()),
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
    minimum: Type.Number(),
    bidders: Type.Array(Type.String()),
    bids: Type.Array(SealedBid),
    // Switzerland and Denmark: the Credit Suisse share or Government Bond offered alongside.
    partner: Type.Optional(Type.Enum(InvestmentItem)),
    previousLevel: Type.Optional(Type.Number())
})

export type ClaimantBid = Type.Static<typeof ClaimantBid>
export const ClaimantBid = Type.Object({
    playerId: Type.String(),
    amount: Type.Number()
})

// After a paired Industry Investment's bids are revealed, the bidders in bid order claim the
// items, each paying their own bid.
export type InvestmentClaim = Type.Static<typeof InvestmentClaim>
export const InvestmentClaim = Type.Object({
    industry: Type.Enum(Industry),
    investorId: Type.String(),
    items: Type.Array(Type.Enum(InvestmentItem)),
    previousLevel: Type.Number(),
    order: Type.Array(ClaimantBid),
    position: Type.Number()
})
