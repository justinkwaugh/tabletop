import { SizedCompanyMarket } from '@tabletop/18xx'
import { EighteenSeventeenCharters } from './charters.js'
import { EighteenSeventeenMarket, isAcquisitionSpace, isLiquidationSpace } from './stockMarket.js'

export const MarketPoolId = 'market'

/** 1817's companies of 2, 5 and 10 shares on its one-row market, sold and shorted to the pool. */
export const EighteenSeventeenCompanyMarket = new SizedCompanyMarket({
    market: EighteenSeventeenMarket,
    charters: EighteenSeventeenCharters,
    marketPoolId: MarketPoolId,
    charterShareCount: 2,
    isLiquidationSpace,
    isAcquisitionSpace
})
