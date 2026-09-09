import { expect, it } from 'vitest'
import {
    createRectangularStockMarket,
    placeStockMarker,
    companyMarketSpace,
    moveMarketSpace,
    stockMarketOrder,
    validateStockMarket
} from './stockMarket.js'

it('distinguishes equal prices and preserves marker order at a movement boundary', () => {
    const market = createRectangularStockMarket([[60, 70], [50, 60], [40]], () => 'white')
    placeStockMarker(market, 'left', '0:0')
    placeStockMarker(market, 'right', '1:1')
    placeStockMarker(market, 'under', '1:1')
    placeStockMarker(market, 'high', '0:1')
    expect(companyMarketSpace(market, 'left').price).toBe(companyMarketSpace(market, 'right').price)
    expect(stockMarketOrder(market)).toEqual(['high', 'right', 'under', 'left'])
    const bottom = moveMarketSpace(market, '1:1', 'down', 4)
    expect(bottom.id).toBe('1:1')
    placeStockMarker(market, 'right', bottom.id)
    expect(market.stacks.find((stack) => stack.spaceId === '1:1')?.companyIds).toEqual([
        'right',
        'under'
    ])
    expect(moveMarketSpace(market, '0:0', 'down', 8).id).toBe('2:0')
    validateStockMarket(market, ['left', 'right', 'under', 'high'])
})
it('follows explicit connections independently of display coordinates', () => {
    const market = createRectangularStockMarket(
        [
            [60, 70],
            [50, 60]
        ],
        () => 'white'
    )
    market.spaces[0].moves.diagonal = '1:1'
    expect(moveMarketSpace(market, '0:0', 'diagonal', 1).id).toBe('1:1')
    market.spaces[0].moves.down = 'missing'
    expect(() => validateStockMarket(market, [])).toThrow('Unknown stock market space')
})
