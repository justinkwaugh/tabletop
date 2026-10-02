import { companyMarketSpace, type StockMarket } from '@tabletop/18xx'
import { isAcquisitionSpace, isLiquidationSpace } from './stockMarket.js'

/** Shares of a company in the acquisition or liquidation zone cannot be bought or sold. */
export function inClosingZone(market: StockMarket, companyId: string): boolean {
    const space = companyMarketSpace(market, companyId)
    return isAcquisitionSpace(space) || isLiquidationSpace(space)
}
