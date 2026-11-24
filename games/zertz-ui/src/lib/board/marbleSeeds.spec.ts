import { describe, expect, it } from 'vitest'
import { coordinatesToNumber } from '@tabletop/common'
import { MarbleColor } from '@tabletop/zertz'
import { marbleSeed } from './marbleSeeds.js'

describe('marbleSeed', () => {
    it('takes the seed the marble carries in the state', () => {
        const ring = { coords: { q: 0, r: 0 }, marble: MarbleColor.Grey, marbleSeed: 42 }
        expect(marbleSeed(ring)).toBe(42)
    })

    it('seeds a marble without one by its ring', () => {
        const ring = { coords: { q: 2, r: -1 }, marble: MarbleColor.Grey }
        expect(marbleSeed(ring)).toBe(coordinatesToNumber({ q: 2, r: -1 }))
    })
})
