import { placeStockMarker } from '@tabletop/18xx'
import type { PreparedPosition } from '@tabletop/18xx/scenarios'
import { createEighteenThirtyTwoStockMarket } from '../index.js'

export function createEighteenThirtyTwoScenarioMarket(position: PreparedPosition) {
    const market = createEighteenThirtyTwoStockMarket()
    placeStockMarker(market, 'ACL', '1:6')
    placeStockMarker(market, 'CG', '0:6')
    if (position === 'flotation') placeStockMarker(market, 'SAL', '5:6')
    return market
}
