import { describe, expect, it } from 'vitest'
import { START_PRICE_INDEX } from '../components/priceTrack.js'
import { perRailroad, type RailroadId } from '../components/railroads.js'
import {
    SaleListRefusal,
    distressSaleProceeds,
    repairsBill,
    saleListRefusal,
    settleRepairs
} from './repairs.js'

const CP = 'railroad.cp'
const UP = 'railroad.up'
const KP = 'railroad.kp'
const SP = 'railroad.sp'

// Prices 5, 10, 1 and 25: distress sales raise 2, 5, 0 and 12.
const PRICE_INDEX: Record<RailroadId, number> = {
    [CP]: START_PRICE_INDEX,
    [UP]: 14,
    [KP]: 5,
    [SP]: 29
}

function holdings(money: number, shares: Partial<Record<RailroadId, number>>) {
    return { money, shares: perRailroad((railroadId) => shares[railroadId] ?? 0) }
}

describe('Promontory Point Repairs', () => {
    it('R-4.3-H1: the bill is $2 per share of the railroad held when the tile is reached', () => {
        expect(repairsBill(holdings(0, { [CP]: 3, [UP]: 5 }).shares, CP)).toBe(6)
        expect(repairsBill(holdings(0, { [UP]: 5 }).shares, CP)).toBe(0)
    })

    it('R-4.3: a distress sale raises half the price, rounded down', () => {
        expect(distressSaleProceeds(PRICE_INDEX, CP)).toBe(2)
        expect(distressSaleProceeds(PRICE_INDEX, UP)).toBe(5)
        expect(distressSaleProceeds(PRICE_INDEX, KP)).toBe(0)
        expect(distressSaleProceeds(PRICE_INDEX, SP)).toBe(12)
        expect(distressSaleProceeds({ ...PRICE_INDEX, [CP]: 2 }, CP)).toBe(0)
    })

    it('R-4.3-H2: a list that stops as soon as the debtor can pay is legal, in any order of railroads', () => {
        const debtor = holdings(1, { [CP]: 2, [UP]: 1, [SP]: 1 })

        expect(saleListRefusal(debtor, 6, PRICE_INDEX, [UP])).toBeUndefined()
        expect(saleListRefusal(debtor, 6, PRICE_INDEX, [CP, CP, UP])).toBeUndefined()
        expect(saleListRefusal(debtor, 6, PRICE_INDEX, [SP])).toBeUndefined()
        expect(settleRepairs(debtor, 6, PRICE_INDEX, [CP, CP, UP])).toEqual({
            proceeds: [2, 2, 5],
            raised: 9,
            paid: 6,
            forgiven: 0
        })
    })

    it('R-4.3-H2: a list that sells on after the debtor can pay is refused', () => {
        const debtor = holdings(1, { [CP]: 2, [UP]: 1 })

        expect(saleListRefusal(debtor, 6, PRICE_INDEX, [UP, CP])).toBe(
            SaleListRefusal.SoldAfterAbleToPay
        )
        expect(saleListRefusal(debtor, 3, PRICE_INDEX, [CP, CP])).toBe(
            SaleListRefusal.SoldAfterAbleToPay
        )
    })

    it('R-4.3-H2: a list that stops while still short with shares left is refused', () => {
        const debtor = holdings(0, { [CP]: 2, [UP]: 1 })

        expect(saleListRefusal(debtor, 10, PRICE_INDEX, [CP, CP])).toBe(
            SaleListRefusal.StoppedWhileShort
        )
        expect(saleListRefusal(debtor, 10, PRICE_INDEX, [])).toBe(SaleListRefusal.StoppedWhileShort)
    })

    it('R-4.3-H2: a list naming a share the debtor does not hold is refused', () => {
        const debtor = holdings(0, { [CP]: 1, [UP]: 1 })

        expect(saleListRefusal(debtor, 6, PRICE_INDEX, [SP])).toBe(SaleListRefusal.NotHeld)
        expect(saleListRefusal(debtor, 6, PRICE_INDEX, [CP, CP, UP])).toBe(SaleListRefusal.NotHeld)
    })

    it('R-4.3-H3: selling every share and still falling short is legal; all is paid and the rest forgiven', () => {
        const debtor = holdings(1, { [CP]: 2, [KP]: 1 })

        expect(saleListRefusal(debtor, 10, PRICE_INDEX, [KP, CP, CP])).toBeUndefined()
        expect(settleRepairs(debtor, 10, PRICE_INDEX, [KP, CP, CP])).toEqual({
            proceeds: [0, 2, 2],
            raised: 4,
            paid: 5,
            forgiven: 5
        })
    })

    it('R-4.3-H3: the empty list is legal only for a debtor with no shares', () => {
        expect(saleListRefusal(holdings(3, {}), 8, PRICE_INDEX, [])).toBeUndefined()
        expect(settleRepairs(holdings(3, {}), 8, PRICE_INDEX, [])).toEqual({
            proceeds: [],
            raised: 0,
            paid: 3,
            forgiven: 5
        })
        expect(saleListRefusal(holdings(3, { [KP]: 1 }), 8, PRICE_INDEX, [])).toBe(
            SaleListRefusal.StoppedWhileShort
        )
    })

    it('R-4.3-H1: selling shares of the billed railroad never lowers the bill', () => {
        const debtor = holdings(1, { [CP]: 3 })
        const owed = repairsBill(debtor.shares, CP)
        expect(owed).toBe(6)

        expect(saleListRefusal(debtor, owed, PRICE_INDEX, [CP, CP])).toBe(
            SaleListRefusal.StoppedWhileShort
        )
        expect(saleListRefusal(debtor, owed, PRICE_INDEX, [CP, CP, CP])).toBeUndefined()
        expect(settleRepairs(debtor, owed, PRICE_INDEX, [CP, CP, CP])).toEqual({
            proceeds: [2, 2, 2],
            raised: 6,
            paid: 6,
            forgiven: 0
        })
    })
})
