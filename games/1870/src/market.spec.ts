import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { LedgeMarket1870, Market1870, SoftLedge1870, reissueParForPrice } from './stockMarket.js'

const space = (row: number, column: number) => Market1870.space(`${row}:${column}`)

function landing(spaceId: string | undefined) {
    assertExists(spaceId, 'The market has that move')
    return Market1870.space(spaceId)
}

describe('the stock market (pp. 6-8)', () => {
    it('starts companies on the red outlined values', () => {
        expect(
            Market1870.spaces.filter((entry) => entry.color === 'pink').map((entry) => entry.price)
        ).toEqual([100, 90, 82, 76, 72, 68])
    })

    it('stops a sale on the ledge unless it pushes two spaces below (p. 7’s $90 example)', () => {
        const ninety = space(4, 9)
        expect(ninety.price).toBe(90)
        const fall = (shares: number) =>
            Market1870.move(ninety.id, 'down', LedgeMarket1870.saleDescent(ninety.id, shares)).price
        expect(fall(1)).toBe(82)
        expect(fall(2)).toBe(82)
        expect(fall(3)).toBe(72)
    })

    it('keeps a token on the ledge for one share and moves it two for two', () => {
        const onLedge = space(5, 9)
        expect(onLedge.price).toBe(82)
        expect(LedgeMarket1870.saleDescent(onLedge.id, 1)).toBe(0)
        expect(LedgeMarket1870.saleDescent(onLedge.id, 2)).toBe(2)
    })

    it('moves a top row token right and down instead of up, and holds $400', () => {
        expect(landing(space(0, 6).moves.up).id).toBe(space(1, 7).id)
        expect(space(0, 20).price).toBe(400)
        expect(space(0, 20).moves.up).toBeUndefined()
    })

    it('turns a rightward move at the ledge upward, and leaves leftward moves alone', () => {
        const atLedge = space(4, 10)
        expect(atLedge.price).toBe(100)
        expect(landing(atLedge.moves.right).id).toBe(atLedge.moves.up)
        const below = space(5, 10)
        expect(below.price).toBe(90)
        expect(landing(below.moves.left).price).toBe(82)
    })

    it('draws the ledge along the upper area’s sides', () => {
        expect(SoftLedge1870).toContainEqual({ spaceId: '5:9', side: 'bottom' })
        expect(SoftLedge1870).toContainEqual({ spaceId: '4:10', side: 'right' })
    })

    it('closes companies in the closed section at $0', () => {
        const closed = Market1870.spaces.filter((entry) => entry.color === 'black')
        expect(closed.every((entry) => entry.price === 0)).toBe(true)
        expect(closed).toHaveLength(6)
    })

    it.each([
        [100, 76],
        [110, 82],
        [120, 90],
        [140, 110],
        [160, 120],
        [180, 140],
        [200, 140],
        [225, 160],
        [250, 180],
        [275, 200],
        [300, 225],
        [325, 250],
        [350, 250],
        [375, 275],
        [400, 300]
    ])('reissues at a $%i share price for $%i', (price, par) => {
        expect(reissueParForPrice(price)).toBe(par)
    })
})
