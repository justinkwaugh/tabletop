import { type StockMarket } from '@tabletop/18xx'
import type { ClosingZone } from './state.js'
import { isAcquisitionSpace, isLiquidationSpace, EighteenSeventeenMarket } from './stockMarket.js'

/** Shares of a company in the acquisition or liquidation zone cannot be bought or sold. */
export function inClosingZone(market: StockMarket, companyId: string): boolean {
    const space = EighteenSeventeenMarket.companySpace(market, companyId)
    return isAcquisitionSpace(space) || isLiquidationSpace(space)
}

export function closingZone(market: StockMarket, companyId: string): ClosingZone | undefined {
    const space = EighteenSeventeenMarket.companySpace(market, companyId)
    if (isLiquidationSpace(space)) return 'liquidation'
    if (isAcquisitionSpace(space)) return 'acquisition'
    return undefined
}
