import * as Type from 'typebox'
import { Owner, type FinancialState } from '../finance/finance.js'
import { StationFields } from '../map/station.js'

export const CompanyTranche = Type.Object(
    {
        id: Type.String(),
        name: Type.String(),
        capacity: Type.Integer({ minimum: 1 }),
        companyIds: Type.Array(Type.String(), { uniqueItems: true })
    },
    { additionalProperties: false }
)
export type CompanyTranche = Type.Static<typeof CompanyTranche>

export const OwnershipLimitExemption = Type.Object(
    {
        owner: Owner,
        companyId: Type.String(),
        maximumShares: Type.Integer({ minimum: 1 })
    },
    { additionalProperties: false }
)
export type OwnershipLimitExemption = Type.Static<typeof OwnershipLimitExemption>

export const CompanyFields = {
    phaseId: Type.String(),
    tranches: Type.Array(CompanyTranche),
    ownershipLimitExemptions: Type.Array(OwnershipLimitExemption),
    ...StationFields
}
export type CompanyState = FinancialState & Type.Static<Type.TObject<typeof CompanyFields>>

export function availableCompanyTranche(
    tranches: readonly CompanyTranche[],
    completed: (companyId: string) => boolean
): CompanyTranche | undefined {
    for (const tranche of tranches) {
        if (tranche.companyIds.length < tranche.capacity) return tranche
        if (!tranche.companyIds.every(completed)) return undefined
    }
    return undefined
}
