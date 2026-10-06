import { expect, it } from 'vitest'
import { createRectangularStockMarket, placeStockMarker } from '@tabletop/18xx'
import type { Point } from '@tabletop/common'
import {
    marketTokenLayout,
    expandedMarketStack,
    MarketCellHeight,
    MarketCellWidth,
    MarketScenePadding,
    MarketTokenSize,
    marketLowerRightSpace
} from './marketTokenLayout.js'

function expectSingleOrderedColumn(expanded: readonly Point[], marketWidth: number) {
    expect(expanded.length).toBeGreaterThan(3)
    for (const [index, point] of expanded.entries()) {
        expect(point.x).toBe(expanded[0].x)
        expect(point.x - MarketTokenSize / 2).toBeGreaterThanOrEqual(0)
        expect(point.x + MarketTokenSize / 2).toBeLessThanOrEqual(marketWidth)
        expect(point.y - MarketTokenSize / 2).toBeGreaterThanOrEqual(0)
        if (index) expect(point.y - expanded[index - 1].y).toBeGreaterThanOrEqual(MarketTokenSize)
    }
}

it('keeps narrow-cell stacks below prices and uses the cell width for market movement', () => {
    const cell = { width: 36, height: 96 }
    const market = createRectangularStockMarket([[40, 50, 60, 70]], () => 'white')
    for (const id of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) placeStockMarker(market, id, '0:0')
    for (const token of marketTokenLayout(market, cell)) {
        expect(token.x - MarketTokenSize / 2).toBeGreaterThanOrEqual(0)
        expect(token.x + MarketTokenSize / 2).toBeLessThanOrEqual(cell.width)
        expect(token.y - MarketTokenSize / 2).toBeGreaterThanOrEqual(20)
        expect(token.y + MarketTokenSize / 2).toBeLessThanOrEqual(cell.height)
    }
    expectSingleOrderedColumn(expandedMarketStack(market, '0:0', cell), 4 * cell.width)
    const before = marketTokenLayout(market, cell).find((token) => token.companyId === 'A')!
    placeStockMarker(market, 'A', '0:1')
    const after = marketTokenLayout(market, cell).find((token) => token.companyId === 'A')!
    expect(after.x - before.x).toBe(cell.width)
})

it('centers one token and stacks two vertically, right of the price, without overlap', () => {
    const market = createRectangularStockMarket([[100]], () => 'white')
    placeStockMarker(market, 'A', '0:0')
    expect(marketTokenLayout(market)[0]).toMatchObject({
        x: MarketCellWidth / 2,
        y: MarketCellHeight / 2,
        overlapped: false
    })
    placeStockMarker(market, 'B', '0:0')
    const [a, b] = marketTokenLayout(market)
    expect(a.x).toBe(b.x)
    expect(a.x).toBeGreaterThan(MarketCellWidth / 2)
    expect(a.x + MarketTokenSize / 2).toBeLessThanOrEqual(MarketCellWidth)
    expect(b.y - a.y).toBeGreaterThanOrEqual(MarketTokenSize)
    expect(a.z).toBeGreaterThan(b.z)
})
it('fits crowded stacks and expands them into one ordered column, including linear markets', () => {
    for (const prices of [
        [[60, 80, 100, 120]],
        [
            [60, 80],
            [50, 70],
            [40, 60],
            [30, 50]
        ]
    ]) {
        const market = createRectangularStockMarket(prices, () => 'white')
        for (const companyId of ['A', 'B', 'C', 'D', 'E', 'F'])
            placeStockMarker(market, companyId, '0:0')
        const compact = marketTokenLayout(market)
        expect(compact.every((item) => item.overlapped)).toBe(true)
        for (const item of compact) {
            expect(item.y - MarketTokenSize / 2).toBeGreaterThanOrEqual(0)
            expect(item.y + MarketTokenSize / 2).toBeLessThanOrEqual(MarketCellHeight)
        }
        expectSingleOrderedColumn(
            expandedMarketStack(market, '0:0'),
            prices[0].length * MarketCellWidth
        )
    }
})
it('keeps stack layer order when a marker arrives in an occupied cell', () => {
    const market = createRectangularStockMarket([[80, 100]], () => 'white')
    placeStockMarker(market, 'A', '0:0')
    placeStockMarker(market, 'B', '0:1')

    placeStockMarker(market, 'A', '0:1')
    const tokens = marketTokenLayout(market)
    expect(tokens.map((item) => item.companyId)).toEqual(['B', 'A'])
    expect(tokens[0].z).toBeGreaterThan(tokens[1].z)
})
it('finds the largest empty lower-right rectangle of a staircase market', () => {
    const market = createRectangularStockMarket(
        [
            [100, 110, 120, 130, 140],
            [90, 100, 110, 120, null],
            [80, 90, 100, null, null],
            [70, 80, null, null, null]
        ],
        () => 'white'
    )
    expect(marketLowerRightSpace(market)).toEqual({
        x: MarketScenePadding + 3 * MarketCellWidth,
        y: MarketScenePadding + 2 * MarketCellHeight,
        width: 2 * MarketCellWidth,
        height: 2 * MarketCellHeight
    })
    expect(
        marketLowerRightSpace(createRectangularStockMarket([[100, 110]], () => 'white'))
    ).toBeUndefined()
})
it('spreads a crowded stack from where the stack sits', () => {
    const market = createRectangularStockMarket(
        [
            [100, 110, 120],
            [90, 100, 110],
            [80, 90, 100],
            [70, 80, 90]
        ],
        () => 'white'
    )
    for (const companyId of ['A', 'B', 'C', 'D']) placeStockMarker(market, companyId, '1:1')
    const stackX = marketTokenLayout(market)[0].x
    expect(expandedMarketStack(market, '1:1').every((point) => point.x === stackX)).toBe(true)
})
