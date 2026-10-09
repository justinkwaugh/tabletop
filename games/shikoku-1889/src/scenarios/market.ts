import type { StockMarket } from '@tabletop/18xx'
import { Shikoku1889Market } from '../index.js'
import type { PreparedPosition } from '@tabletop/18xx/scenarios'

export function createShikoku1889ScenarioMarket(position: PreparedPosition) {
    const market: StockMarket = { stacks: [] }
    Shikoku1889Market.placeMarker(market, 'AR', '1:3')
    Shikoku1889Market.placeMarker(market, 'IR', '0:3')
    if (position === 'flotation') Shikoku1889Market.placeMarker(market, 'SR', '5:3')
    return market
}
