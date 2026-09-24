import { placeStockMarker } from '@tabletop/18xx'
import { createShikoku1889StockMarket } from '../index.js'
import type { PreparedPosition } from '@tabletop/18xx/scenarios'

export function createShikoku1889ScenarioMarket(position: PreparedPosition) {
    const market = createShikoku1889StockMarket()
    placeStockMarker(market, 'AR', '1:3')
    placeStockMarker(market, 'IR', '0:3')
    if (position === 'flotation') placeStockMarker(market, 'SR', '5:3')
    return market
}
