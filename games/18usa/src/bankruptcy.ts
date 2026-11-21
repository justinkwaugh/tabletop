import { sizedCompanyElimination, type CashCrisisRules } from '@tabletop/18xx'
import { EighteenUSACharters } from './charters.js'
import { EighteenUSAMarket } from './stockMarket.js'
import { EighteenUSACompanyMarket } from './marketZones.js'
import { EighteenUSAStockRules } from './stockRules.js'

export const EighteenUSACashCrisisRules: CashCrisisRules = {
    market: EighteenUSAMarket,
    charters: EighteenUSACharters,
    // A cash crisis arises outside the stock round, when even a company that has not yet
    // operated may be sold (§15).
    saleTerms: (state, companyId, shares) =>
        EighteenUSACompanyMarket.marketSale(state, companyId, shares),
    presidencyCandidates: EighteenUSAStockRules.presidencyCandidates,
    afterSale: (state) => EighteenUSACompanyMarket.closeMarketShortsAgainstPool(state),
    elimination: sizedCompanyElimination(EighteenUSACompanyMarket)
}
