import type { StockMarket } from '@tabletop/18xx'
import type { PreparedPosition } from '@tabletop/18xx/scenarios'
import { EighteenThirtyTwoMarket } from '../index.js'

export function createEighteenThirtyTwoScenarioMarket(position: PreparedPosition) {
    const market: StockMarket = { stacks: [] }
    EighteenThirtyTwoMarket.placeMarker(market, 'ACL', '1:6')
    EighteenThirtyTwoMarket.placeMarker(market, 'CG', '0:6')
    if (position === 'flotation') EighteenThirtyTwoMarket.placeMarker(market, 'SAL', '5:6')
    return market
}
