import * as Type from 'typebox'
import { sameOwner, type FinancialState, type Owner } from '../finance/finance.js'
import { AuctionAward } from './waterfallAuction.js'

export const AwardedShare = Type.Object(
    {
        certificateId: Type.String(),
        companyId: Type.String(),
        shares: Type.Integer({ minimum: 1 }),
        president: Type.Boolean()
    },
    { additionalProperties: false }
)
export type AwardedShare = Type.Static<typeof AwardedShare>
export const AuctionAwardDetails = Type.Object(
    {
        ...AuctionAward.properties,
        shares: Type.Optional(Type.Array(AwardedShare))
    },
    { additionalProperties: false }
)
export type AuctionAwardDetails = Type.Static<typeof AuctionAwardDetails>

export class AuctionAwardRecorder {
    private readonly owners: Map<string, Owner>
    constructor(state: Pick<FinancialState, 'certificates'>) {
        this.owners = new Map(
            state.certificates.flatMap((certificate) =>
                certificate.retired ? [] : [[certificate.id, { ...certificate.owner }]]
            )
        )
    }
    award(state: Pick<FinancialState, 'certificates'>, award: AuctionAward): AuctionAwardDetails {
        return {
            ...award,
            shares: state.certificates.flatMap((certificate) => {
                if (
                    certificate.kind !== 'share' ||
                    certificate.retired ||
                    certificate.owner.kind !== 'player' ||
                    certificate.owner.playerId !== award.playerId
                )
                    return []
                const before = this.owners.get(certificate.id)
                if (before && sameOwner(before, certificate.owner)) return []
                return [
                    {
                        certificateId: certificate.id,
                        companyId: certificate.companyId,
                        shares: certificate.shares,
                        president: certificate.president === true
                    }
                ]
            })
        }
    }
}
