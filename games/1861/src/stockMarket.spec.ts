import { describe, expect, it } from 'vitest'
import {
    MajorStartSpaces1861,
    Market1861,
    MinorRightMove,
    MinorStartSpaces1861,
    convertible,
    majorStartSpaceAtOrBelow,
    minorStartSpace
} from './stockMarket.js'

const at = (row: number, column: number) => Market1861.space(`${row}:${column}`)
const price = (spaceId: string | undefined) =>
    spaceId === undefined ? undefined : Market1861.space(spaceId).price

describe('the stock market', () => {
    it('starts minors on R50 to R135 and public companies on R70 to R200 (§9.2, §9.3)', () => {
        expect(MinorStartSpaces1861.map((space) => space.price)).toEqual([
            50, 55, 60, 65, 70, 80, 90, 100, 110, 120, 135
        ])
        expect(MajorStartSpaces1861.map((space) => space.price)).toEqual([
            70, 80, 90, 100, 110, 120, 135, 150, 165, 180, 200
        ])
        expect(MinorStartSpaces1861.map((space) => space.color)).toEqual([
            ...Array(4).fill('brown'),
            ...Array(7).fill('red')
        ])
        expect(MajorStartSpaces1861.slice(7).map((space) => space.color)).toEqual(
            Array(4).fill('purple')
        )
    })

    it('starts a minor at half its winning bid, rounded down to a start value (§9.2)', () => {
        expect(minorStartSpace(100).price).toBe(50)
        expect(minorStartSpace(145).price).toBe(70)
        expect(minorStartSpace(230).price).toBe(110)
        expect(minorStartSpace(400).price).toBe(135)
    })

    it('starts a formed public company at or below its price, at most R200 (§12.2, §12.3)', () => {
        expect(majorStartSpaceAtOrBelow(100).price).toBe(100)
        expect(majorStartSpaceAtOrBelow(155).price).toBe(150)
        expect(majorStartSpaceAtOrBelow(330).price).toBe(200)
    })

    it('lets minors convert from the yellow seventh column, R100 to R165 (§12.2)', () => {
        const spaces = Market1861.spaces.filter(convertible)
        expect(spaces.map((space) => space.price).toSorted((a, b) => a - b)).toEqual([
            100, 110, 120, 135, 150, 165
        ])
        expect(spaces.every((space) => space.column === 6)).toBe(true)
        expect(convertible(at(3, 5))).toBe(false)
    })

    it('moves minors right up to the seventh column, then up it, and no further (§10.7)', () => {
        expect(price(at(4, 5).moves[MinorRightMove])).toBe(110)
        expect(at(4, 6).moves[MinorRightMove]).toBe('3:6')
        expect(at(0, 6).moves[MinorRightMove]).toBeUndefined()
        expect(at(6, 5).moves[MinorRightMove]).toBe('5:5')
        expect(at(2, 7).moves[MinorRightMove]).toBeUndefined()
    })

    it('moves a public company off the top row right and down, to the same price (§9.5)', () => {
        expect(price(at(0, 5).moves.up)).toBe(150)
        expect(at(0, 5).moves.up).toBe('1:6')
        expect(at(0, 18).moves.up).toBeUndefined()
        expect(at(1, 5).moves.up).toBe('0:5')
    })

    it('moves left, or down where the row ends, and right, or up where it ends (§10.7)', () => {
        const market = { stacks: [{ spaceId: '0:4', companyIds: ['NW'] }] }
        expect(Market1861.dividendMove(market, 'NW', false).toMarketSpaceId).toBe('1:4')
        const top = { stacks: [{ spaceId: '0:18', companyIds: ['NW'] }] }
        expect(Market1861.dividendMove(top, 'NW', true).toMarketSpaceId).toBe('0:18')
        const end = { stacks: [{ spaceId: '3:11', companyIds: ['NW'] }] }
        expect(price(Market1861.dividendMove(end, 'NW', true).toMarketSpaceId)).toBe(220)
        const corner = { stacks: [{ spaceId: '9:0', companyIds: ['NW'] }] }
        expect(Market1861.dividendMove(corner, 'NW', false).toMarketSpaceId).toBe('9:0')
    })

    it('drops a row for a director’s sale, staying put at the bottom (§9.1)', () => {
        expect(price(at(2, 6).moves.down)).toBe(120)
        expect(at(9, 0).moves.down).toBeUndefined()
    })
})
