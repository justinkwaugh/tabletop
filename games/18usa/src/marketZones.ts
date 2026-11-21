import { SizedCompanyMarket } from '@tabletop/18xx'
import { EighteenUSACharters } from './charters.js'
import { EighteenUSAMarket, isAcquisitionSpace, isLiquidationSpace } from './stockMarket.js'

export const MarketPoolId = 'market'

/** 18USA's companies of 2, 5 and 10 shares on its one-row market, sold and shorted to the pool. */
export const EighteenUSACompanyMarket = new SizedCompanyMarket({
    market: EighteenUSAMarket,
    charters: EighteenUSACharters,
    marketPoolId: MarketPoolId,
    charterShareCount: 2,
    isLiquidationSpace,
    isAcquisitionSpace
})
