import { describe, expect, it } from 'vitest'
import {
    BlueZoneSpaceIds1849,
    ClosedSpaceId1849,
    EndGameSpaceId1849,
    Market1849,
    parSpaceIds1849
} from './stockMarket.js'

const price = (spaceId: string) => Market1849.space(spaceId).price
const prices = (spaceIds: readonly string[]) => spaceIds.map(price).sort((a, b) => a - b)

describe('the stock market (§5)', () => {
    it('has ten ragged rows', () => {
        const rowLengths = Array.from(
            { length: 10 },
            (_, row) => Market1849.spaces.filter((space) => space.row === row).length
        )
        expect(rowLengths).toEqual([16, 16, 16, 14, 13, 12, 11, 10, 7, 4])
        expect(price('0:0')).toBe(72)
        expect(price('8:6')).toBe(56)
    })

    it('opens L. 144 from phase 6 and L. 216 from phase 10 (§9.4)', () => {
        expect(prices(parSpaceIds1849('4H'))).toEqual([68, 100])
        expect(prices(parSpaceIds1849('6H'))).toEqual([68, 100, 144])
        expect(prices(parSpaceIds1849('8H'))).toEqual([68, 100, 144])
        expect(prices(parSpaceIds1849('10H'))).toEqual([68, 100, 144, 216])
        expect(prices(parSpaceIds1849('16H'))).toEqual([68, 100, 144, 216])
    })

    it('marks the blue phase 16 section, the game end and the Closed box', () => {
        expect(prices(BlueZoneSpaceIds1849)).toEqual([242, 266, 269, 295, 298, 306, 328, 340])
        for (const id of BlueZoneSpaceIds1849) expect(Market1849.space(id).color).toBe('blue')
        expect(price(EndGameSpaceId1849)).toBe(377)
        expect(EndGameSpaceId1849).toBe('0:15')
        expect(ClosedSpaceId1849).toBe('9:0')
        expect(price(ClosedSpaceId1849)).toBe(0)
        expect(Market1849.space(ClosedSpaceId1849).color).toBe('black')
    })

    it('ends the fourth row at L. 230, below the blue zone (§9.7)', () => {
        const space = Market1849.space('3:13')
        expect(space.price).toBe(230)
        expect(Market1849.space(space.moves.up).color).toBe('blue')
    })
})
