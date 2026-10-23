import { Color } from '@tabletop/common'
import { seededRandom } from './random.js'

export type Tone = 'white' | 'black'

export function toneOf(color: Color): Tone {
    return color === Color.Black ? 'black' : 'white'
}

export type RingStyle = { face: string; side: string; edge: string; speck: string }
export type MarkerStyle = { face: string; edge: string }

// The rings are flecked like granite, white with black and black with white.
export const RING_STYLES: Record<Tone, RingStyle> = {
    white: { face: '#efede7', side: '#c9c6bd', edge: '#6f6c66', speck: '#1b1b1d' },
    black: { face: '#1f2023', side: '#0f1012', edge: '#000000', speck: '#e9e7e1' }
}

// A marker shows one face inside a lip of the blue its side is made of.
export const MARKER_STYLES: Record<Tone, MarkerStyle> = {
    white: { face: '#f4f2ec', edge: '#6f7a8c' },
    black: { face: '#17181b', edge: '#000000' }
}
export const MARKER_BLUE = { face: '#2f62cc', side: '#24509f', edge: '#132f6b' }

// Like LYNGK's pieces and ZÈRTZ's marbles: small flecks of varied size, stretched and turned.
// Positions and sizes are fractions of the piece's outer radius.
export type Speck = { x: number; y: number; r: number; stretch: number; angle: number }

// A speck on the side seen below the top face: x across the width, v down the band.
export type SideSpeck = { x: number; v: number; r: number; stretch: number; angle: number }

export type ColoredSpeck<T> = T & { color: string }

// Black flecks on white read as sparser than white flecks on black, so white carries more.
const RING_FACE_SPECKS: Record<Tone, number> = { white: 105, black: 65 }
const RING_SIDE_SPECKS = 16

// The marker's blue is flecked with both white and black, on its lip and down its side.
const MARKER_LIP_SPECKS = 26
const MARKER_SIDE_SPECKS = 12
const MARKER_SPECK_COLORS = ['#f4f2ec', '#101114']

function speckShape(random: () => number) {
    return {
        r: 0.012 + 0.024 * random() ** 2,
        stretch: 1 + random() * 1.2,
        angle: random() * 180
    }
}

// Specks spread evenly over the band between two radii.
function bandSpecks(random: () => number, count: number, inner: number, outer: number): Speck[] {
    return Array.from({ length: count }, () => {
        const angle = random() * Math.PI * 2
        const distance = Math.sqrt(inner ** 2 + (outer ** 2 - inner ** 2) * random())
        return {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            ...speckShape(random)
        }
    })
}

function sideSpecks(random: () => number, count: number): SideSpeck[] {
    return Array.from({ length: count }, () => ({
        x: (random() * 2 - 1) * 0.94,
        v: 0.2 + random() * 0.6,
        ...speckShape(random)
    }))
}

export function ringSpecks(tone: Tone, seed: number, innerRatio: number) {
    const random = seededRandom(seed)
    return {
        face: bandSpecks(random, RING_FACE_SPECKS[tone], innerRatio + 0.04, 0.96),
        side: sideSpecks(random, RING_SIDE_SPECKS)
    }
}

export function markerSpecks(seed: number, lipRatio: number) {
    const random = seededRandom(seed)
    const colored = <T>(speck: T, index: number): ColoredSpeck<T> => ({
        ...speck,
        color: MARKER_SPECK_COLORS[index % MARKER_SPECK_COLORS.length]
    })
    return {
        lip: bandSpecks(random, MARKER_LIP_SPECKS, lipRatio + 0.03, 0.95).map(colored),
        side: sideSpecks(random, MARKER_SIDE_SPECKS).map(colored)
    }
}

export function seedOf(key: string): number {
    let hash = 2166136261
    for (const char of key) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    }
    return hash
}
