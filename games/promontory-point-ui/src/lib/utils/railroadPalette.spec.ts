import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RAILROAD_IDS, type RailroadId } from '@tabletop/promontory-point'
import { railroadColour, railroadInk } from './railroadPalette.js'

const appCss = readFileSync(new URL('../../app.css', import.meta.url), 'utf8')

// Components, railroads: Central Pacific blue, Union Pacific purple, Kansas Pacific red,
// Southern Pacific yellow. Hue ranges in degrees.
const HUES: Record<RailroadId, { name: string; from: number; to: number }> = {
    'railroad.cp': { name: 'blue', from: 180, to: 250 },
    'railroad.up': { name: 'purple', from: 270, to: 330 },
    'railroad.kp': { name: 'red', from: 345, to: 375 },
    'railroad.sp': { name: 'yellow', from: 40, to: 65 }
}

function tokenHex(token: string): string {
    const value = new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i').exec(appCss)?.[1]
    expect(value, token).toBeDefined()
    return value ?? ''
}

function hue(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    const max = Math.max(r, g, b)
    const delta = max - Math.min(r, g, b)
    const sector =
        max === r
            ? ((g - b) / delta + 6) % 6
            : max === g
              ? (b - r) / delta + 2
              : (r - g) / delta + 4
    return sector * 60
}

describe('railroad palette', () => {
    it.each(RAILROAD_IDS)(
        'O-1: %s is drawn in its own token, in the colour the components give it',
        (railroadId) => {
            const tag = railroadId.replace('railroad.', '')
            expect(railroadColour(railroadId)).toBe(`var(--pp-${tag})`)

            const { name, from, to } = HUES[railroadId]
            const degrees = hue(tokenHex(`--pp-${tag}`))
            const wrapped = degrees < from ? degrees + 360 : degrees
            expect(wrapped, `${railroadId} is ${name}`).toBeGreaterThanOrEqual(from)
            expect(wrapped, `${railroadId} is ${name}`).toBeLessThanOrEqual(to)
        }
    )

    it('O-1: the four railroads have four colours, and light yellow takes the dark ink', () => {
        expect(new Set(RAILROAD_IDS.map(railroadColour)).size).toBe(4)
        expect(RAILROAD_IDS.map(railroadInk)).toEqual([
            'var(--pp-rr-ink)',
            'var(--pp-rr-ink)',
            'var(--pp-rr-ink)',
            'var(--pp-ink)'
        ])
    })
})
