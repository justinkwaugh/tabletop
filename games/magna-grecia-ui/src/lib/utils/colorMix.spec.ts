import { describe, expect, it } from 'vitest'
import { darken, lighten, mixColor } from './colorMix.js'

describe('colour mixing', () => {
    it('blends hex colours channel by channel', () => {
        expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080')
        expect(lighten('#d02329', 0)).toBe('#d02329')
        expect(darken('#ffffff', 1)).toBe('#1a1208')
    })

    it('leaves colours it cannot parse unchanged', () => {
        expect(mixColor('red', '#ffffff', 0.5)).toBe('red')
    })
})
