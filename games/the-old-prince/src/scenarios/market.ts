import { placeStockMarker } from '@tabletop/18xx'
import { createTheOldPrinceStockMarket } from '../index.js'
import type { PreparedPosition } from '@tabletop/18xx/scenarios'

const ThirdCompanyPositions: readonly PreparedPosition[] = [
    'flotation',
    'privates',
    'private-events',
    'transfers',
    'powers'
]
export function createTheOldPrinceScenarioMarket(position: PreparedPosition) {
    const market = createTheOldPrinceStockMarket()
    placeStockMarker(market, 'ML', '1:1')
    placeStockMarker(market, 'So', '2:1')
    if (ThirdCompanyPositions.includes(position)) placeStockMarker(market, 'A', '3:1')
    return market
}
