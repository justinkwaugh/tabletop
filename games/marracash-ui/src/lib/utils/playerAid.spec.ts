import { describe, expect, it } from 'vitest'
import { MarketColor } from '@tabletop/marracash'
import {
    antiquePayoutRows,
    antiqueValueRanges,
    auctionBonusRows,
    customerPayoutRows,
    moverBonusRows
} from './playerAid.js'

describe('player aid tables', () => {
    it('lists customer payouts up to the capped fifth customer', () => {
        expect(customerPayoutRows()).toEqual([
            { label: '1st', amount: 100 },
            { label: '2nd', amount: 200 },
            { label: '3rd', amount: 300 },
            { label: '4th', amount: 400 },
            { label: '5th+', amount: 500 }
        ])
    })

    it('splits the mover and auction bonuses at their rule thresholds', () => {
        expect(moverBonusRows()).toEqual([
            { label: 'up to 300', amount: 50 },
            { label: 'over 300', amount: 100 }
        ])
        expect(auctionBonusRows()).toEqual([
            { label: 'up to 500', amount: 100 },
            { label: 'over 500', amount: 200 }
        ])
    })

    it('ranks antique values from the cheapest colour', () => {
        expect(antiqueValueRanges()).toEqual([
            { color: MarketColor.Red, lowest: 50, highest: 150 },
            { color: MarketColor.Purple, lowest: 75, highest: 175 },
            { color: MarketColor.Green, lowest: 100, highest: 200 },
            { color: MarketColor.Blue, lowest: 125, highest: 225 },
            { color: MarketColor.Yellow, lowest: 150, highest: 250 }
        ])
    })

    it('pays one card fewer per finishing place, with a row per player', () => {
        expect(antiquePayoutRows(3)).toEqual([
            { place: '1st', paidCards: 5 },
            { place: '2nd', paidCards: 4 },
            { place: '3rd', paidCards: 3 }
        ])
        expect(antiquePayoutRows(4).at(-1)).toEqual({ place: '4th', paidCards: 2 })
    })
})
