import { Color } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ColorblindColorizer } from './colorblindPalette.js'

describe('ColorblindColorizer contrast', () => {
    const colorizer = new ColorblindColorizer()

    it.each([Color.Yellow, Color.White])('uses black text and borders on %s', (color) => {
        expect(colorizer.getTextColor(color)).toBe('text-black')
        expect(colorizer.getBorderContrastColor(color)).toBe('border-black')
    })

    it.each([Color.Red, Color.Blue, Color.Black, Color.Brown])(
        'uses white text and borders on %s',
        (color) => {
            expect(colorizer.getTextColor(color)).toBe('text-white')
            expect(colorizer.getBorderContrastColor(color)).toBe('border-white')
        }
    )
})
