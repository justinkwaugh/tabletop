import { priceProtectedStock, soldThisStockRound } from '@tabletop/18xx'
import { Charters1870, CompanyIds1870 } from './companies.js'
import { requireState1870, type HydratedState1870 } from './state.js'
import { LedgeMarket1870, reissueParForPrice } from './stockMarket.js'
import { Phases1870 } from './trains.js'

const Stock = priceProtectedStock<HydratedState1870>({
    ledgeMarket: LedgeMarket1870,
    charters: Charters1870,
    companyIds: CompanyIds1870,
    phases: Phases1870,
    requireState: requireState1870,
    // For ten and for nine companies; the limit falls when a company closes and then stays (p. 7,
    // p. 31). Seven players are from the designer's own table.
    certificateLimits: {
        2: [28, 24],
        3: [20, 17],
        4: [16, 14],
        5: [13, 11],
        6: [11, 9],
        7: [9, 7]
    },
    reissueParForPrice,
    // A company reissues only with no shares on the initial offering display (p. 17).
    reissueNeedsEmptyOffering: true,
    // A company that has operated redeems one share a stock round (p. 16).
    mayRedeem: (company) => !!company.operated,
    // A president who sold the company this stock round may not protect it (p. 13).
    mayProtect: (state, companyId, playerId) =>
        state.stockRound.completed ||
        !soldThisStockRound(state.stockRound, { kind: 'player', playerId }, companyId)
})

export const StockRoundRules1870 = Stock.roundRules
export const OperatingRules1870 = Stock.operatingRules
export const OwnershipExcess1870 = Stock.ownershipExcess
export const PriceProtection1870 = Stock.priceProtection
export const ShareRedemption1870 = Stock.shareRedemption
export const ShareTrading1870 = Stock.shareTrading
export const StockRules1870 = Stock.stockRules
export const TrainFundingRules1870 = Stock.trainFundingRules
export const reissueParPrice = Stock.reissueParPrice
export const tableCertificateLimit = Stock.certificateLimit
