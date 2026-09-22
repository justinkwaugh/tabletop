import { assertExists } from '@tabletop/common'
import { getCompany, sameOwner, sharesOwned } from '../finance/finance.js'
import * as Type from 'typebox'
import { Owner, type FinancialState } from '../finance/finance.js'
import type { StockState } from '../stock/stockState.js'
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

export const StockCompanyFields = {
    phaseId: Type.String(),
    ownershipLimitExemptions: Type.Array(OwnershipLimitExemption)
}
export const TrancheFields = { tranches: Type.Array(CompanyTranche) }
export const CompanyFields = { ...StockCompanyFields, ...TrancheFields, ...StationFields }
export type StockCompanyState = FinancialState &
    Type.Static<Type.TObject<typeof StockCompanyFields>>
export type CompanyState = FinancialState & Type.Static<Type.TObject<typeof CompanyFields>>
export type FormationState = StockState & CompanyState

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

export function grantOwnershipLimitExemption(
    state: StockCompanyState,
    companyId: string,
    owner: Owner
): void {
    const company = getCompany(state, companyId)
    assertExists(company.shareCount, 'Ownership exemptions require shares')
    const maximumShares = sharesOwned(state, companyId, owner)
    const existing = state.ownershipLimitExemptions.find(
        (entry) => entry.companyId === companyId && sameOwner(entry.owner, owner)
    )
    if (existing) existing.maximumShares = Math.max(existing.maximumShares, maximumShares)
    else state.ownershipLimitExemptions.push({ companyId, owner, maximumShares })
}
