import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { OathColors } from '@tabletop/oath'
import { OATH_PLAYER_COLOR_PALETTE, OathGameColorizer } from './colorizer.js'
import { OathUiRuntime } from './runtime.js'

/** R-1.8, R-1.9 — the host draws each seat in the colour the game gives it. */
describe("Oath's player colour palette", () => {
    it('is the palette the UI runtime declares', () => {
        expect(OathUiRuntime.playerColorPalette).toBe(OATH_PLAYER_COLOR_PALETTE)
    })

    it('covers the six seat colours and the unseated viewer, each filled with its table colour', () => {
        const colorizer = new OathGameColorizer()
        expect(Object.keys(OATH_PLAYER_COLOR_PALETTE).sort()).toEqual([...OathColors, Color.Gray].sort())
        for (const color of [...OathColors, Color.Gray]) {
            expect(OATH_PLAYER_COLOR_PALETTE[color]?.fill).toBe(colorizer.getUiColor(color))
        }
    })

    it('puts dark text on the pale boards and white text on the rest', () => {
        expect(OATH_PLAYER_COLOR_PALETTE[Color.White]).toEqual({ fill: '#e8e0d0', text: '#000000', contrast: '#000000' })
        expect(OATH_PLAYER_COLOR_PALETTE[Color.Yellow]?.text).toBe('#000000')
        expect(OATH_PLAYER_COLOR_PALETTE[Color.Purple]).toEqual({ fill: '#804796', text: '#ffffff', contrast: '#ffffff' })
    })
})
