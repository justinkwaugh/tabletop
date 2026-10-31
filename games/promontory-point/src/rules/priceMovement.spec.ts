import { describe, expect, it } from 'vitest'
import {
    MAX_PRICE_INDEX,
    MIN_PRICE_INDEX,
    START_PRICE_INDEX,
    sharePriceAt
} from '../components/priceTrack.js'
import { movePrice } from './priceMovement.js'

const PRICE_1_INDEX = 5

describe('Promontory Point price movement', () => {
    it('R-1.2: moves by the change within the track, not capped', () => {
        expect(movePrice(START_PRICE_INDEX, 3)).toEqual({ priceIndex: 12, capped: false })
        expect(movePrice(START_PRICE_INDEX, -2)).toEqual({ priceIndex: 7, capped: false })
        expect(movePrice(MAX_PRICE_INDEX - 3, 3)).toEqual({
            priceIndex: MAX_PRICE_INDEX,
            capped: false
        })
    })

    it('R-1.2: stops at 25 and reports the lost movement as capped', () => {
        expect(movePrice(MAX_PRICE_INDEX - 1, 3)).toEqual({
            priceIndex: MAX_PRICE_INDEX,
            capped: true
        })
        expect(movePrice(MAX_PRICE_INDEX, 1)).toEqual({ priceIndex: MAX_PRICE_INDEX, capped: true })
        expect(sharePriceAt(movePrice(MAX_PRICE_INDEX - 2, 5).priceIndex)).toBe(25)
    })

    it('R-1.2: stops at the last 0 and reports the lost movement as capped', () => {
        expect(movePrice(1, -3)).toEqual({ priceIndex: MIN_PRICE_INDEX, capped: true })
        expect(movePrice(MIN_PRICE_INDEX, -1)).toEqual({
            priceIndex: MIN_PRICE_INDEX,
            capped: true
        })
        expect(movePrice(3, -3)).toEqual({ priceIndex: MIN_PRICE_INDEX, capped: false })
    })

    it('R-1.2: the five 0 spaces are distinct: −3 from price 1 lands on the third 0 and +1 from there stays at 0', () => {
        const thirdZero = movePrice(PRICE_1_INDEX, -3)
        expect(thirdZero).toEqual({ priceIndex: 2, capped: false })
        expect(sharePriceAt(thirdZero.priceIndex)).toBe(0)

        const oneUp = movePrice(thirdZero.priceIndex, 1)
        expect(oneUp).toEqual({ priceIndex: 3, capped: false })
        expect(sharePriceAt(oneUp.priceIndex)).toBe(0)
        expect(sharePriceAt(movePrice(thirdZero.priceIndex, 3).priceIndex)).toBe(1)
    })
})
