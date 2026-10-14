import { describe, expect, it } from 'vitest'
import { NapoleonsTriumphColorizer } from './colorizer.js'

describe('the colours of the two armies', () => {
    it('are never swapped for the colours a player prefers', () => {
        expect(new NapoleonsTriumphColorizer().allowPreferredPlayerColors()).toBe(false)
    })
})
