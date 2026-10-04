import { describe, expect, it } from 'vitest'
import { suggestPayment } from './payment.js'

describe('suggested tech payments', () => {
    it('covers the cost with the least overspend, then the fewest markers', () => {
        expect(suggestPayment([4, 4, 3, 5], 10, 0)).toEqual({ markers: [4, 4, 3], cash: 0 })
        expect(suggestPayment([5, 5, 1], 10, 0)).toEqual({ markers: [5, 5], cash: 0 })
        expect(suggestPayment([3, 3, 4], 10, 0)).toEqual({ markers: [4, 3, 3], cash: 0 })
    })

    it('tops up with cash when markers fall short, or gives up when cash cannot', () => {
        expect(suggestPayment([2, 1], 10, 9)).toEqual({ markers: [2, 1], cash: 7 })
        expect(suggestPayment([2, 1], 10, 5)).toBeUndefined()
        expect(suggestPayment([], 5, 5)).toEqual({ markers: [], cash: 5 })
    })
})
