import { EighteenSeventeenCharters } from './charters.js'
import { EighteenSeventeenMarket } from './stockMarket.js'
import { sizedCompanyElimination, type CashCrisisRules } from '@tabletop/18xx'
import { EighteenSeventeenCompanyMarket } from './marketZones.js'
import { EighteenSeventeenStockRules } from './stockRules.js'

export const EighteenSeventeenCashCrisisRules: CashCrisisRules = {
    market: EighteenSeventeenMarket,
    charters: EighteenSeventeenCharters,
    // A cash crisis arises in an operating round, when even a company that has not yet
    // operated may be sold.
    saleTerms: (state, companyId, shares) =>
        EighteenSeventeenCompanyMarket.marketSale(state, companyId, shares),
    presidencyCandidates: EighteenSeventeenStockRules.presidencyCandidates,
    afterSale: (state) => EighteenSeventeenCompanyMarket.closeMarketShortsAgainstPool(state),
    elimination: sizedCompanyElimination(EighteenSeventeenCompanyMarket)
}
