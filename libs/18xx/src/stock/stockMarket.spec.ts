import { expect, it } from 'vitest'
import {
    createRectangularStockMarketSpaces,
    placeStockMarker,
    removeStockMarker,
    restoreStockMarker,
    stockMarkerStackIndex,
    StockMarketChart,
    type StockMarket
} from './stockMarket.js'

it('distinguishes equal prices and preserves marker order at a movement boundary', () => {
    const chart = new StockMarketChart(
        createRectangularStockMarketSpaces([[60, 70], [50, 60], [40]], () => 'white')
    )
    const market: StockMarket = { stacks: [] }
    chart.placeMarker(market, 'left', '0:0')
    chart.placeMarker(market, 'right', '1:1')
    chart.placeMarker(market, 'under', '1:1')
    chart.placeMarker(market, 'high', '0:1')
    expect(chart.companySpace(market, 'left').price).toBe(chart.companySpace(market, 'right').price)
    expect(chart.order(market)).toEqual(['high', 'right', 'under', 'left'])
    const bottom = chart.move('1:1', 'down', 4)
    expect(bottom.id).toBe('1:1')
    placeStockMarker(market, 'right', bottom.id)
    expect(market.stacks.find((stack) => stack.spaceId === '1:1')?.companyIds).toEqual([
        'right',
        'under'
    ])
    expect(chart.move('0:0', 'down', 8).id).toBe('2:0')
    chart.validate(market, ['left', 'right', 'under', 'high'])
    removeStockMarker(market, 'high')
    removeStockMarker(market, 'right')
    expect(chart.order(market)).toEqual(['under', 'left'])
    expect(market.stacks.map((stack) => stack.spaceId)).toEqual(['0:0', '1:1'])
})
it('follows explicit connections independently of display coordinates', () => {
    const spaces = createRectangularStockMarketSpaces(
        [
            [60, 70],
            [50, 60]
        ],
        () => 'white'
    )
    spaces[0].moves.diagonal = '1:1'
    expect(new StockMarketChart(spaces).move('0:0', 'diagonal', 1).id).toBe('1:1')
    spaces[0].moves.down = 'missing'
    expect(() => new StockMarketChart(spaces)).toThrow('Unknown stock market space')
})

it('rejects duplicate spaces and markers placed off the chart', () => {
    const spaces = createRectangularStockMarketSpaces([[60, 70]], () => 'white')
    expect(() => new StockMarketChart([...spaces, spaces[0]])).toThrow(
        'Duplicate stock market space'
    )
    const chart = new StockMarketChart(spaces)
    const market: StockMarket = { stacks: [] }
    expect(() => chart.placeMarker(market, 'A', 'missing')).toThrow('Unknown stock market space')
    expect(() =>
        chart.validate({ stacks: [{ spaceId: 'missing', companyIds: ['A'] }] }, ['A'])
    ).toThrow('Unknown stock market space')
})

it('keeps its own frozen copy of the printed spaces', () => {
    const spaces = createRectangularStockMarketSpaces([[60, 70]], () => 'white')
    const chart = new StockMarketChart(spaces)
    spaces[0].price = 1
    expect(chart.space('0:0').price).toBe(60)
    expect(Object.isFrozen(chart.space('0:0').moves)).toBe(true)
})

it('moves a company’s marker and records the move unless it stays put', () => {
    const chart = new StockMarketChart(
        createRectangularStockMarketSpaces([[40, 50, 60]], () => 'white')
    )
    const market: StockMarket = { stacks: [] }
    chart.placeMarker(market, 'A', '0:1')
    expect(chart.moveCompanyMarker(market, 'A', 'left', 1)).toEqual({
        companyId: 'A',
        fromMarketSpaceId: '0:1',
        toMarketSpaceId: '0:0'
    })
    expect(chart.moveCompanyMarker(market, 'A', 'left', 1)).toBeUndefined()
})

it('returns a marker to its earlier place in a stack', () => {
    const market: StockMarket = { stacks: [] }
    for (const id of ['first', 'second', 'third']) placeStockMarker(market, id, '0:0')
    expect(stockMarkerStackIndex(market, 'second')).toBe(1)
    placeStockMarker(market, 'second', '0:1')
    restoreStockMarker(market, 'second', '0:0', 1)
    expect(market.stacks.find((stack) => stack.spaceId === '0:0')?.companyIds).toEqual([
        'first',
        'second',
        'third'
    ])
    expect(market.stacks.map((stack) => stack.spaceId)).toEqual(['0:0'])
    placeStockMarker(market, 'third', '0:1')
    restoreStockMarker(market, 'third', '0:0', 5)
    expect(market.stacks[0].companyIds).toEqual(['first', 'second', 'third'])
})
