import { Color } from '@tabletop/common'
import type { PieceKind } from '@tabletop/tzaar'
import { seededRandom } from './random.js'

export type Tone = 'white' | 'black'

// A piece as drawn: its colour, its type, and the key its flecks are seeded by.
export type ShapePiece = { tone: Tone; kind: PieceKind; seedKey: string }

export function toneOf(color: Color): Tone {
    return color === Color.Black ? 'black' : 'white'
}

// The materials a piece's surfaces are made of: its own plastic, and the metal of its markings.
export type Surface = Tone | 'gold' | 'silver'

export function metalOf(tone: Tone): Surface {
    return tone === 'white' ? 'gold' : 'silver'
}

// `face` is a surface facing up, `bevel` one turned toward you and `edge` one turned away.
export type SurfaceStyle = { face: string; edge: string; bevel: string }

export const SURFACE_STYLES: Record<Surface, SurfaceStyle> = {
    // A cool, very white plastic under the flecks, as YINSH's white rings are.
    white: { face: '#f0f2f7', edge: '#787c8a', bevel: '#ffffff' },
    black: { face: '#232427', edge: '#000000', bevel: '#8d8c86' },
    gold: { face: '#cf9f3c', edge: '#6e4a10', bevel: '#f3d98e' },
    silver: { face: '#a3a6aa', edge: '#45484d', bevel: '#e6e8ea' }
}

// Flecked like the real pieces: white with black, black with white.
export const SPECK_COLORS: Record<Tone, string> = { white: '#1b1b1d', black: '#e9e7e1' }

// Positions and sizes are fractions of the piece's radius.
export type Speck = {
    x: number
    y: number
    r: number
    stretch: number
    angle: number
}
// A speck on the side band: x across the width, v down the band.
export type SideSpeck = {
    x: number
    v: number
    r: number
    stretch: number
    angle: number
}

// Flecks per unit of area (the piece's radius squared), the same on every surface. Black flecks
// on white read as sparser than white flecks on black, so white carries more.
const SPECK_DENSITY: Record<Tone, number> = { white: 29.7, black: 19.1 }

function speckCount(tone: Tone, area: number): number {
    return Math.round(SPECK_DENSITY[tone] * area)
}

function speckShape(random: () => number) {
    return {
        r: 0.014 + 0.026 * random() ** 2,
        stretch: 1 + random() * 1.2,
        angle: random() * 180
    }
}

// Over the whole top, out to just inside the rounded edge; the drawing lowers those in the
// hollows to their floors and leaves out those on metal.
export function topSpecks(tone: Tone, seed: number): Speck[] {
    const random = seededRandom(seed)
    const outer = 0.95
    return Array.from({ length: speckCount(tone, Math.PI * outer ** 2) }, () => {
        const angle = random() * Math.PI * 2
        const distance = Math.sqrt(random()) * outer
        return {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            ...speckShape(random)
        }
    })
}

// The near half of the outer side, `thickness` of the radius tall.
export function sideSpecks(tone: Tone, seed: number, thickness: number): SideSpeck[] {
    const random = seededRandom(seed ^ 0x5f3759df)
    return Array.from({ length: speckCount(tone, Math.PI * thickness) }, () => ({
        x: (random() * 2 - 1) * 0.94,
        v: 0.2 + random() * 0.6,
        ...speckShape(random)
    }))
}

export function seedOf(key: string): number {
    let hash = 2166136261
    for (const char of key) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    }
    return hash
}
