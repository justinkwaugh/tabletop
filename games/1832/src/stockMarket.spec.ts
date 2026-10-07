import { describe, expect, it } from 'vitest'
import {
    dividendMarketMove,
    moveMarketSpace,
    placeStockMarker,
    stockMarketSpace
} from '@tabletop/18xx'
import {
    EighteenThirtyTwoSoftLedge,
    createEighteenThirtyTwoStockMarket,
    isClosingSpace,
    isLowerArea,
    saleDescent
} from './index.js'

const market = createEighteenThirtyTwoStockMarket()
const space = (id: string) => stockMarketSpace(market, id)
const at = (row: number, column: number) => `${row}:${column}`

describe('the 1832 stock market', () => {
    it('starts companies on the red-outlined par values', () => {
        expect(
            market.spaces.filter((space) => space.color === 'pink').map((space) => space.price)
        ).toEqual([100, 90, 82, 76, 72, 68])
    })

    it('colors its areas and closes companies in the black area', () => {
        expect(space(at(0, 0)).color).toBe('yellow')
        expect(space(at(3, 0)).color).toBe('green')
        expect(space(at(5, 0)).color).toBe('brown')
        expect(isClosingSpace(space(at(8, 0)))).toBe(true)
        expect(isLowerArea(space(at(2, 16)))).toBe(true)
        expect(isLowerArea(space(at(1, 16)))).toBe(false)
    })

    it('stops a one-space fall onto the soft ledge, but lets two shares cross it', () => {
        expect(saleDescent(market, at(1, 16), 1)).toBe(0)
        expect(saleDescent(market, at(1, 16), 2)).toBe(2)
        expect(saleDescent(market, at(0, 17), 2)).toBe(1)
        expect(saleDescent(market, at(0, 17), 3)).toBe(3)
        expect(saleDescent(market, at(2, 16), 1)).toBe(1)
        expect(saleDescent(market, at(3, 16), 4)).toBe(0)
    })

    it('moves right across the soft ledge by going up instead', () => {
        const from = at(1, 15)
        expect(isLowerArea(space(at(1, 16)))).toBe(false)
        const ledge = at(2, 15)
        expect(space(ledge).moves.right).toBe(at(1, 15))
        expect(space(from).moves.right).toBe(at(1, 16))
    })

    it('moves a top-row company right and down for an up move, and holds $400', () => {
        expect(moveMarketSpace(market, at(0, 6), 'up', 1).id).toBe(at(1, 7))
        expect(space(at(1, 7)).price).toBe(space(at(0, 6)).price)
        expect(moveMarketSpace(market, at(0, 20), 'up', 1).id).toBe(at(0, 20))
    })

    it('pays right, falls left, and turns down at the left edge', () => {
        const prepared = createEighteenThirtyTwoStockMarket()
        placeStockMarker(prepared, 'ACL', at(4, 0))
        expect(dividendMarketMove(prepared, 'ACL', false).toMarketSpaceId).toBe(at(5, 0))
        expect(dividendMarketMove(prepared, 'ACL', true).toMarketSpaceId).toBe(at(4, 1))
    })
})

describe('the soft ledge', () => {
    it('runs below the upper area and beside it where the lower area steps up', () => {
        expect(EighteenThirtyTwoSoftLedge).toContainEqual({ spaceId: '1:16', side: 'bottom' })
        expect(EighteenThirtyTwoSoftLedge).toContainEqual({ spaceId: '2:15', side: 'right' })
        expect(EighteenThirtyTwoSoftLedge.some((edge) => edge.spaceId === '2:16')).toBe(false)
    })
})
