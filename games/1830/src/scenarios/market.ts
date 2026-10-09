import type { StockMarket } from '@tabletop/18xx'
import { EighteenThirtyMarket } from '../index.js'
import type { PreparedPosition } from '@tabletop/18xx/scenarios'

export function createEighteenThirtyScenarioMarket(position: PreparedPosition) {
    const market: StockMarket = { stacks: [] }
    EighteenThirtyMarket.placeMarker(market, 'NYC', '1:6')
    EighteenThirtyMarket.placeMarker(market, 'PRR', '0:6')
    if (position === 'flotation') EighteenThirtyMarket.placeMarker(market, 'CO', '5:6')
    return market
}
