import { describe, expect, it } from 'vitest'
import {
    EndGameSpaceId1822,
    MajorParSpaceIds1822,
    Market1822,
    MarketZoneColors1822,
    MinorOnlyParSpaceId1822,
    MinorParSpaceIds1822,
    NoLimitSpaceIds1822,
    minorParSpaceId1822
} from './stockMarket.js'

const price = (spaceId: string) => Market1822.space(spaceId).price
const prices = (spaceIds: readonly string[]) => spaceIds.map(price).sort((a, b) => a - b)
const at = (value: number, column: number) => {
    const space = Market1822.spaces.find(
        (space) => space.price === value && space.column === column
    )
    if (!space) throw new Error(`No ${value} in column ${column}`)
    return space
}

describe('the stock market (§4.4, §5.14.4)', () => {
    it('is fifteen ragged rows', () => {
        const rowLengths = Array.from(
            { length: 15 },
            (_, row) => Market1822.spaces.filter((space) => space.row === row).length
        )
        expect(rowLengths).toEqual([4, 8, 12, 21, 21, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5])
        expect(price('3:0')).toBe(70)
        expect(price('14:0')).toBe(5)
    })

    it('starts majors at £60 to £100 and minors at £50 too (§3.3.5, §3.4.8, §4.4.1)', () => {
        expect(prices(MajorParSpaceIds1822)).toEqual([60, 70, 80, 90, 100])
        expect(price(MinorOnlyParSpaceId1822)).toBe(50)
        expect(prices(MinorParSpaceIds1822)).toEqual([50, 60, 70, 80, 90, 100])
        expect(new Set(MinorParSpaceIds1822.map((id) => Market1822.space(id).column)).size).toBe(1)
        for (const id of MajorParSpaceIds1822)
            expect(Market1822.space(id).color).toBe(MarketZoneColors1822.par)
        expect(Market1822.space(MinorOnlyParSpaceId1822).color).toBe(MarketZoneColors1822.minorPar)
    })

    it('starts a minor at half its bid, rounded down to a starting value (Table 5)', () => {
        const start = (bid: number) => price(minorParSpaceId1822(bid))
        expect([100, 105, 110, 115].map(start)).toEqual([50, 50, 50, 50])
        expect([120, 125, 130, 135].map(start)).toEqual([60, 60, 60, 60])
        expect([145, 250, 350].map(start)).toEqual([70, 100, 100])
    })

    it('marks the yellow spaces and the value that ends the game (§1.3.1, §4.4.2)', () => {
        expect(NoLimitSpaceIds1822).toHaveLength(41)
        expect(Math.max(...NoLimitSpaceIds1822.map(price))).toBe(60)
        expect(price(EndGameSpaceId1822)).toBe(700)
        expect(Market1822.space(EndGameSpaceId1822).moves).toEqual({ left: '0:19', down: '1:20' })
    })

    it('drops a space a share sold, stopping at the bottom (§4.6.3)', () => {
        expect(Market1822.move(at(100, 4).id, 'down', 3).price).toBe(70)
        expect(Market1822.move(at(100, 4).id, 'down', 20).price).toBe(25)
        expect(Market1822.move('14:0', 'down', 1).id).toBe('14:0')
    })

    it('rises a space, or diagonally down to the right from the top of the chart (§4.11.1)', () => {
        expect(Market1822.move(at(100, 4).id, 'up', 1).price).toBe(110)
        expect(Market1822.space(at(200, 9).id).moves.up).toBe(at(200, 10).id)
        expect(at(200, 10).row).toBe(at(200, 9).row + 1)
        expect(Market1822.space('3:0').moves.up).toBe('4:1')
        expect(Market1822.space(EndGameSpaceId1822).moves.up).toBeUndefined()
    })

    it('moves right for a dividend and left without one, up or down where the row ends (§5.14.5–§5.14.9)', () => {
        const stacks = (spaceId: string) => ({ stacks: [{ spaceId, companyIds: ['MR'] }] })
        const after = (spaceId: string, paying: boolean) =>
            Market1822.dividendMove(stacks(spaceId), 'MR', paying).toMarketSpaceId
        expect(price(after(at(100, 4).id, true))).toBe(110)
        expect(price(after(at(100, 4).id, false))).toBe(90)
        // The fourth row ends at £550 beneath £600, and begins at £70 above £60.
        expect(after('3:20', true)).toBe('2:20')
        expect(after('3:0', false)).toBe('4:0')
        expect(after('14:0', false)).toBe('14:0')
        expect(after(EndGameSpaceId1822, true)).toBe(EndGameSpaceId1822)
    })
})
