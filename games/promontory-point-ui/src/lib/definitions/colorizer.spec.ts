import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PromontoryPointRuntime } from '@tabletop/promontory-point'
import { PROMONTORY_POINT_PLAYER_COLOR_PALETTE, PromontoryPointGameColorizer } from './colorizer.js'

const appCss = readFileSync(new URL('../../app.css', import.meta.url), 'utf8')
const railroadColours = ['cp', 'up', 'kp', 'sp'].map((tag) => {
    const value = new RegExp(`--pp-${tag}:\\s*(#[0-9a-f]{6})`, 'i').exec(appCss)?.[1]
    expect(value, `--pp-${tag}`).toBeDefined()
    return value?.toLowerCase()
})

describe('seat colours', () => {
    const colorizer = new PromontoryPointGameColorizer()

    it('O-1: the seats are green, orange, black and white, each drawn in its own colour', () => {
        expect(PromontoryPointRuntime.playerColors).toEqual([
            Color.Green,
            Color.Orange,
            Color.Black,
            Color.White
        ])
        const fills = PromontoryPointRuntime.playerColors.map((color) =>
            colorizer.getUiColor(color)
        )
        expect(fills).toEqual(
            PromontoryPointRuntime.playerColors.map(
                (color) => PROMONTORY_POINT_PLAYER_COLOR_PALETTE[color]?.fill
            )
        )
        expect(new Set(fills).size).toBe(4)
        expect(fills).not.toContain(colorizer.getUiColor(Color.Gray))
    })

    it('O-1: no seat colour is a railroad colour', () => {
        for (const color of PromontoryPointRuntime.playerColors) {
            expect(railroadColours).not.toContain(colorizer.getUiColor(color).toLowerCase())
        }
    })

    it('the header classes follow the same colours', () => {
        expect(colorizer.getBgColor(Color.Orange)).toBe('bg-[#e07b28]')
        expect(colorizer.getTextColor(Color.White)).toBe('text-[#2b2a24]')
        expect(colorizer.getBorderColor(Color.Black)).toBe('border-[#26272b]')
    })
})
