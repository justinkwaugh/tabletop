import { Color } from '@tabletop/common'
import { seededRandom } from './random.js'

export type Tone = 'white' | 'black'

export function toneOf(color: Color): Tone {
    return color === Color.Black ? 'black' : 'white'
}

export type RingStyle = { face: string; innerEdge: string; edge: string; speck: string }
export type MarkerStyle = { edge: string }
export const MARKER_BLUE = { lip: '#2f62cc', wall: '#1f4796', edge: '#132f6b' }

// The rings are flecked like granite: the white ones a cool white with dark flecks, the black
// ones with pale flecks. The rounded inner edge catches the light.
export const RING_STYLES: Record<Tone, RingStyle> = {
    white: { face: '#eceef2', innerEdge: '#dfe2e8', edge: '#6f7480', speck: '#2a1c25' },
    black: { face: '#1f2023', innerEdge: '#34353a', edge: '#000000', speck: '#e3e9ec' }
}

// A marker shows one face inside a lip of the blue its side is made of.
export const MARKER_STYLES: Record<Tone, MarkerStyle> = {
    white: { edge: '#1d3c80' },
    black: { edge: '#0b1530' }
}

// Like LYNGK's pieces and ZÈRTZ's marbles: small flecks of varied size, stretched and turned.
// Positions and sizes are fractions of the piece's outer radius.
export type Speck = { x: number; y: number; r: number; stretch: number; angle: number }

// A speck on the side seen below the top face: x across the width, v down the band.
export type SideSpeck = { x: number; v: number; r: number; stretch: number; angle: number }

export type ColoredSpeck<T> = T & { color: string }

// Black flecks on white read as sparser than white flecks on black, so white carries more.
const RING_FACE_SPECKS: Record<Tone, number> = { white: 105, black: 55 }
// The black rings' pale flecks are finer, as on the published ones.
const RING_SPECK_SIZE: Record<Tone, number> = { white: 1, black: 0.75 }
const RING_SIDE_SPECKS = 16
// The far half of the inner wall: about as dense as the side.
const RING_WALL_SPECKS = 14

// The marker's blue is flecked with both white and black, on its lip and down its side.
const MARKER_LIP_SPECKS = 26
const MARKER_SIDE_SPECKS = 22
const MARKER_WALL_SPECKS = 10
const MARKER_SPECK_COLORS = ['#e6ecf5', '#101114']

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

// A speck on the far half of a ring's inner wall: at `angle` round the hole, behind its middle,
// and `v` up the wall.
export type WallSpeck = { angle: number; v: number; r: number; stretch: number; angle2: number }

function wallSpecks(random: () => number, count: number): WallSpeck[] {
    return Array.from({ length: count }, () => {
        const { angle, ...shape } = speckShape(random)
        return { angle: Math.PI * (1.04 + random() * 0.92), v: random(), ...shape, angle2: angle }
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
    const sized = <T extends { r: number }>(speck: T): T => ({
        ...speck,
        r: speck.r * RING_SPECK_SIZE[tone]
    })
    return {
        face: bandSpecks(random, RING_FACE_SPECKS[tone], innerRatio + 0.01, 0.96).map(sized),
        side: sideSpecks(random, RING_SIDE_SPECKS).map(sized),
        wall: wallSpecks(random, RING_WALL_SPECKS).map(sized)
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
        side: sideSpecks(random, MARKER_SIDE_SPECKS).map(colored),
        wall: wallSpecks(random, MARKER_WALL_SPECKS).map(colored)
    }
}

export function seedOf(key: string): number {
    let hash = 2166136261
    for (const char of key) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    }
    return hash
}
