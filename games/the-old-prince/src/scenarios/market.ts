import type { StockMarket } from '@tabletop/18xx'
import { TheOldPrinceMarket } from '../index.js'
import type { PreparedPosition } from '@tabletop/18xx/scenarios'

const ThirdCompanyPositions: readonly PreparedPosition[] = [
    'flotation',
    'privates',
    'private-events',
    'transfers',
    'powers'
]
export function createTheOldPrinceScenarioMarket(position: PreparedPosition) {
    const market: StockMarket = { stacks: [] }
    TheOldPrinceMarket.placeMarker(market, 'ML', '1:1')
    TheOldPrinceMarket.placeMarker(market, 'So', '2:1')
    if (ThirdCompanyPositions.includes(position)) TheOldPrinceMarket.placeMarker(market, 'A', '3:1')
    return market
}
