import { marketCorporateFinance } from '@tabletop/18xx'
import { Market1846 } from './stock.js'

export const CorporateFinanceRules1846 = marketCorporateFinance({
    market: Market1846,
    marketPoolId: 'open-market',
    topRedemptionPrice: 600
})
