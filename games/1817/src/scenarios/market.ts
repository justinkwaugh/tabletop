import type { StockMarket } from '@tabletop/18xx'
import { EighteenSeventeenMarket } from '../index.js'

export function createEighteenSeventeenScenarioMarket() {
    const market: StockMarket = { stacks: [] }
    EighteenSeventeenMarket.placeMarker(market, 'BA', '0:15')
    EighteenSeventeenMarket.placeMarker(market, 'PLE', '0:9')
    return market
}
