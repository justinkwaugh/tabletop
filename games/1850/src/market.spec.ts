import { describe, expect, it } from 'vitest'
import { LedgeMarket1850, Market1850, SoftLedge1850, reissueParForPrice } from './stockMarket.js'

const space = (row: number, column: number) => Market1850.space(`${row}:${column}`)

describe('the stock market (§5.1, §5.8)', () => {
    it('starts companies on the red outlined values', () => {
        expect(
            Market1850.spaces.filter((entry) => entry.color === 'pink').map((entry) => entry.price)
        ).toEqual([100, 90, 82, 76, 72, 68])
    })

    it('stops a sale on the soft ledge unless it pushes two spaces below', () => {
        const onLedge = space(5, 9)
        expect(onLedge.price).toBe(82)
        expect(LedgeMarket1850.saleDescent(onLedge.id, 1)).toBe(0)
        expect(LedgeMarket1850.saleDescent(onLedge.id, 2)).toBe(2)
    })

    it('moves a top row token right and down instead of up, and holds $400', () => {
        expect(space(0, 6).moves.up).toBe(space(1, 7).id)
        expect(space(0, 20).moves.up).toBeUndefined()
    })

    it('draws the ledge along the upper area', () => {
        expect(SoftLedge1850).toContainEqual({ spaceId: '5:9', side: 'bottom' })
    })

    it('colours the left of the market as the board does', () => {
        expect(space(4, 0).color).toBe('green')
        expect(space(5, 0).color).toBe('brown')
        expect(space(6, 5).color).toBe('white')
    })

    it('closes companies in the black area at $0', () => {
        const closed = Market1850.spaces.filter((entry) => entry.color === 'black')
        expect(closed.every((entry) => entry.price === 0)).toBe(true)
        expect(closed).toHaveLength(6)
    })
})

describe('reissue par (§5.1.2, §5.11)', () => {
    it.each([
        [90, 68],
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
        [400, 200]
    ])('reissues a $%i share at $%i', (price, par) => {
        expect(reissueParForPrice(price)).toBe(par)
    })
})
