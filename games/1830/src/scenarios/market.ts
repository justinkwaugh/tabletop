import { placeStockMarker } from '@tabletop/18xx'
import { createEighteenThirtyStockMarket } from '../index.js'
import type { PreparedPosition } from '@tabletop/18xx/scenarios'

export function createEighteenThirtyScenarioMarket(position: PreparedPosition) {
    const market = createEighteenThirtyStockMarket()
    placeStockMarker(market, 'NYC', '1:6')
    placeStockMarker(market, 'PRR', '0:6')
    if (position === 'flotation') placeStockMarker(market, 'CO', '5:6')
    return market
}
