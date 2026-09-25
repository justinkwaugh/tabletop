import { expect, it } from 'vitest'
import { createRectangularStockMarket, placeStockMarker } from '@tabletop/18xx'
import {
    marketTokenLayout,
    expandedMarketStack,
    MarketCellHeight,
    MarketCellWidth,
    MarketScenePadding,
    MarketTokenSize,
    marketLowerRightSpace
} from './marketTokenLayout.js'

it('centers one token and stacks two vertically without overlap', () => {
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
    expect(b.y - a.y).toBeGreaterThanOrEqual(MarketTokenSize)
    expect(a.z).toBeGreaterThan(b.z)
})
it('fits crowded stacks and expands every token without overlap, including linear markets', () => {
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
        const expanded = expandedMarketStack(market, '0:0')
        for (const [index, point] of expanded.entries()) {
            expect(point.x - MarketTokenSize / 2).toBeGreaterThanOrEqual(0)
            expect(point.y - MarketTokenSize / 2).toBeGreaterThanOrEqual(0)
            expect(point.x + MarketTokenSize / 2).toBeLessThanOrEqual(
                prices[0].length * MarketCellWidth
            )
            expect(point.y + MarketTokenSize / 2).toBeLessThanOrEqual(
                prices.length * MarketCellHeight
            )
            for (const other of expanded.slice(index + 1))
                expect(Math.hypot(point.x - other.x, point.y - other.y)).toBeGreaterThanOrEqual(
                    MarketTokenSize
                )
        }
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
