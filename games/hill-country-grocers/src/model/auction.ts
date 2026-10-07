import * as Type from 'typebox'
import { SimpleAuction } from '@tabletop/common'
import { CompanyId } from '../components/companies.js'

export enum AuctionKind {
    Initial = 'Initial',
    Share = 'Share'
}

export type ShareAuction = Type.Static<typeof ShareAuction>
export const ShareAuction = Type.Object({
    kind: Type.Enum(AuctionKind),
    companyId: Type.Enum(CompanyId),
    bidding: SimpleAuction
})
