import { describe, expect, it } from 'vitest'
import {
    LeftMove,
    MajorStartSpaces1867,
    Market1867,
    MarketZoneColors1867,
    MinorRightMove,
    MinorStartSpaces1867,
    convertible,
    majorStartSpaceAtOrBelow,
    minorStartSpace
} from './stockMarket.js'

const at = (price: number) => {
    const space = Market1867.spaces.find((candidate) => candidate.price === price)
    if (!space) throw new Error(`No space at ${price}`)
    return space
}
const price = (spaceId: string | undefined) =>
    spaceId === undefined ? undefined : Market1867.space(spaceId).price
const prices = (spaces: readonly { price: number }[]) => spaces.map((space) => space.price)

describe('the column market', () => {
    it('runs in one row from $35 to $540 (§4)', () => {
        expect(prices(Market1867.spaces)).toEqual([
            35, 40, 45, 50, 55, 60, 65, 70, 80, 90, 100, 110, 120, 135, 150, 165, 180, 200, 220,
            245, 270, 300, 330, 360, 400, 440, 490, 540
        ])
        expect(new Set(Market1867.spaces.map((space) => space.row))).toEqual(new Set([0]))
    })

    it('starts minors on $50 to $135 and majors on $70 to $200 (§4.1, §7.2.1, §7.4)', () => {
        expect(prices(MinorStartSpaces1867)).toEqual([
            50, 55, 60, 65, 70, 80, 90, 100, 110, 120, 135
        ])
        expect(prices(MajorStartSpaces1867)).toEqual([
            70, 80, 90, 100, 110, 120, 135, 150, 165, 180, 200
        ])
    })

    it('colours the orange, pink, blue and teal zones (§4.1)', () => {
        const colors = Object.fromEntries(
            Market1867.spaces.map((space) => [space.price, space.color])
        )
        expect([50, 65].map((value) => colors[value])).toEqual(
            Array(2).fill(MarketZoneColors1867.minorStart)
        )
        expect([70, 90].map((value) => colors[value])).toEqual(
            Array(2).fill(MarketZoneColors1867.start)
        )
        expect([100, 135, 150, 165].map((value) => colors[value])).toEqual(
            Array(4).fill(MarketZoneColors1867.convert)
        )
        expect([180, 200].map((value) => colors[value])).toEqual(
            Array(2).fill(MarketZoneColors1867.majorStart)
        )
        expect([35, 45, 220, 540].map((value) => colors[value])).toEqual(Array(4).fill('white'))
    })

    it('starts a minor at half its winning bid, rounded down to a start value (§7.2.1)', () => {
        expect(minorStartSpace(100).price).toBe(50)
        expect(minorStartSpace(145).price).toBe(70)
        expect(minorStartSpace(230).price).toBe(110)
        expect(minorStartSpace(400).price).toBe(135)
    })

    it('starts a formed major at or below its price, at most $200 (§9.1, §9.2)', () => {
        expect(majorStartSpaceAtOrBelow(100).price).toBe(100)
        expect(majorStartSpaceAtOrBelow(155).price).toBe(150)
        expect(majorStartSpaceAtOrBelow(330).price).toBe(200)
    })

    it('lets minors convert from $100 to $165 (§9.1)', () => {
        expect(prices(Market1867.spaces.filter(convertible))).toEqual([
            100, 110, 120, 135, 150, 165
        ])
    })

    it('moves a paying minor right, but never past $165 (§4.3)', () => {
        expect(price(at(150).moves[MinorRightMove])).toBe(165)
        expect(at(165).moves[MinorRightMove]).toBeUndefined()
        expect(price(at(165).moves.right)).toBe(180)
    })

    it('moves right for a dividend and left for none, staying put at either end (§4.3)', () => {
        const market = (spaceId: string) => ({ stacks: [{ spaceId, companyIds: ['GTR'] }] })
        expect(
            price(Market1867.dividendMove(market(at(100).id), 'GTR', true).toMarketSpaceId)
        ).toBe(110)
        expect(
            price(Market1867.dividendMove(market(at(100).id), 'GTR', false).toMarketSpaceId)
        ).toBe(90)
        expect(
            price(Market1867.dividendMove(market(at(540).id), 'GTR', true).toMarketSpaceId)
        ).toBe(540)
        expect(
            price(Market1867.dividendMove(market(at(35).id), 'GTR', false).toMarketSpaceId)
        ).toBe(35)
    })

    it('moves one space left for a President’s sale and right when sold out (§4.3, §7.3.1)', () => {
        expect(price(at(120).moves[LeftMove])).toBe(110)
        expect(price(at(120).moves.down)).toBe(110)
        expect(price(at(120).moves.up)).toBe(135)
        expect(at(35).moves.down).toBeUndefined()
    })
})
