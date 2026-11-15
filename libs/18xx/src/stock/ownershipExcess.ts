import { assertExists } from '@tabletop/common'
import { companyShareCount, type CompanyCharters } from '../company/companyCharters.js'
import { sharesOwned, type Owner } from '../finance/finance.js'
import type { StockMarketChart } from './stockMarket.js'
import type { StockRules } from './stockRules.js'
import type { StockState } from './stockState.js'

/**
 * A holding above the ownership limit, gained by protecting a price or a merger: kept until its
 * holder next sells that company, but not added to (1832, 1870).
 */
export class OwnershipExcess {
    constructor(
        private readonly options: {
            market: StockMarketChart
            charters: CompanyCharters
            percent: number
            freeColors: readonly string[]
        }
    ) {}

    ceiling(state: StockState, companyId: string): number {
        const shareCount = companyShareCount(state, this.options.charters, companyId)
        assertExists(shareCount, 'Ownership limits require a share count')
        return Math.floor((this.options.percent * shareCount) / 100)
    }

    withHeldExcess(ownershipLimit: StockRules['ownershipLimit']): StockRules['ownershipLimit'] {
        return (state, companyId, owner) => {
            const limit = ownershipLimit(state, companyId, owner)
            if (owner.kind !== 'player') return limit
            const shareCount = companyShareCount(state, this.options.charters, companyId)
            if (!shareCount) return limit
            return Math.max(limit, (sharesOwned(state, companyId, owner) * 100) / shareCount)
        }
    }

    requiredSellDown(state: StockState, companyId: string, seller: Owner): number {
        const space = this.options.market.companySpace(state.stockMarket, companyId)
        if (this.options.freeColors.includes(space.color)) return 0
        return Math.max(0, sharesOwned(state, companyId, seller) - this.ceiling(state, companyId))
    }

    withSellDown(saleTerms: StockRules['saleTerms']): StockRules['saleTerms'] {
        return (state, companyId, shares, seller) => {
            const terms = saleTerms(state, companyId, shares, seller)
            if (typeof terms === 'string') return terms
            return shares < this.requiredSellDown(state, companyId, seller)
                ? `Sell down to ${this.options.percent}% of this company.`
                : terms
        }
    }
}
