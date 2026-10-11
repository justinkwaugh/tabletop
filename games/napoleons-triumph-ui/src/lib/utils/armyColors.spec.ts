import { describe, expect, it } from 'vitest'
import { shadeOf, washedOut } from './armyColors.js'

const RED = { block: '#a8272d', shade: shadeOf('#a8272d'), ink: '#ffffff' }
const BLUE = { block: '#1f62a8', shade: shadeOf('#1f62a8'), ink: '#ffffff' }

function channels(hex: string): number[] {
    return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
}

function spread(hex: string): number {
    return Math.max(...channels(hex)) - Math.min(...channels(hex))
}

function distance(a: string, b: string): number {
    return Math.hypot(...channels(a).map((channel, index) => channel - channels(b)[index]))
}

describe('the paint of a piece set aside', () => {
    it('is a solid colour, so nothing shows through it', () => {
        for (const value of Object.values(washedOut(RED))) {
            expect(value).toMatch(/^#[0-9a-f]{6}$/)
        }
    })

    it('is duller than the army colour but still tells the armies apart', () => {
        expect(spread(washedOut(RED).block)).toBeLessThan(spread(RED.block) / 2)
        expect(spread(washedOut(BLUE).block)).toBeLessThan(spread(BLUE.block) / 2)
        expect(distance(washedOut(RED).block, washedOut(BLUE).block)).toBeGreaterThan(60)
    })

    it('keeps the unit symbols readable on the washed block', () => {
        const washed = washedOut(RED)
        expect(distance(washed.ink, washed.block)).toBeGreaterThan(80)
        expect(distance(washed.shade, washed.block)).toBeGreaterThan(30)
    })

    it('darkens a colour for the lower edge of a block', () => {
        expect(shadeOf('#ffffff')).toBe('#c2c2c2')
        expect(shadeOf('#000000')).toBe('#000000')
    })
})
