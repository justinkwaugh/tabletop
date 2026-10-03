import { placeStockMarker } from '@tabletop/18xx'
import { createEighteenSeventeenStockMarket } from '../index.js'

export function createEighteenSeventeenScenarioMarket() {
    const market = createEighteenSeventeenStockMarket()
    placeStockMarker(market, 'BA', '0:15')
    placeStockMarker(market, 'PLE', '0:9')
    return market
}
