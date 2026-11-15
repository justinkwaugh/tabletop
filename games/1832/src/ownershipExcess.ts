import { OwnershipExcess, type Owner, type StockRules, type StockState } from '@tabletop/18xx'
import { EighteenThirtyTwoCharters } from './charters.js'
import { EighteenThirtyTwoMarket } from './stockMarket.js'

export const OwnershipPercent = 60

// A player above 60% of a company, through protection or a merger, keeps the excess until they
// next sell its shares, but may not add to it, and then sells down to 60% (§5.4.1, §5.9.8).
const Excess = new OwnershipExcess({
    market: EighteenThirtyTwoMarket,
    charters: EighteenThirtyTwoCharters,
    percent: OwnershipPercent,
    freeColors: ['green', 'brown']
})

export function ownershipCeiling(state: StockState, companyId: string): number {
    return Excess.ceiling(state, companyId)
}

export function withHeldExcess(
    ownershipLimit: StockRules['ownershipLimit']
): StockRules['ownershipLimit'] {
    return Excess.withHeldExcess(ownershipLimit)
}

export function requiredSellDown(state: StockState, companyId: string, seller: Owner): number {
    return Excess.requiredSellDown(state, companyId, seller)
}

export function withSellDown(saleTerms: StockRules['saleTerms']): StockRules['saleTerms'] {
    return Excess.withSellDown(saleTerms)
}
