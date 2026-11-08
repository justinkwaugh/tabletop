import { Color } from '@tabletop/common'
import { isDvonnPiece, type Piece } from '@tabletop/dvonn'
import { seededRandom } from './random.js'

export type Tone = 'white' | 'black' | 'red'

export function toneOf(color: Color): Tone {
    return color === Color.Black ? 'black' : 'white'
}

// `face` is the top facing up, `bevel` a surface turned toward you and `edge` one turned away.
// `wall` is the inside of the hole, in shadow; `seam` parts two pieces seen down it.
export type PieceStyle = {
    face: string
    edge: string
    bevel: string
    speck: string
    // A second fleck color, mixed in among the first.
    speckAlt?: string
    wall: string
    seam: string
}

// Flecked like the real pieces: white with black, black with white, red with both.
export const PIECE_STYLES: Record<Tone, PieceStyle> = {
    // A cool, very white plastic under the flecks, as YINSH's white rings are.
    white: {
        face: '#f0f2f7',
        edge: '#787c8a',
        bevel: '#ffffff',
        speck: '#1b1b1d',
        wall: '#c6c2b8',
        seam: '#5f626b'
    },
    black: {
        face: '#232427',
        edge: '#000000',
        bevel: '#8d8c86',
        speck: '#e9e7e1',
        wall: '#0a0a0b',
        seam: '#3a3a40'
    },
    red: {
        face: '#d23a2c',
        edge: '#5e130c',
        bevel: '#f07a66',
        speck: '#f3ede6',
        speckAlt: '#2a0d09',
        wall: '#8a1d14',
        seam: '#3d0a06'
    }
}

// Positions and sizes are fractions of the piece's radius.
export type Speck = {
    x: number
    y: number
    r: number
    stretch: number
    angle: number
    alt: boolean
}
// A speck on the side band: x across the width, v down the band.
export type SideSpeck = {
    x: number
    v: number
    r: number
    stretch: number
    angle: number
    alt: boolean
}
// A speck on the far half of the hole's wall: `turn` around it from one side (0) to the other
// (1), v down it.
export type WallSpeck = {
    turn: number
    v: number
    r: number
    stretch: number
    angle: number
    alt: boolean
}

// Flecks per unit of area (the piece's radius squared), the same on every surface. Black flecks
// on white read as sparser than white flecks on black, so white carries more.
const SPECK_DENSITY: Record<Tone, number> = { white: 29.7, black: 19.1, red: 19.1 }

// The share of a piece's flecks in its second color.
const ALT_SHARE: Record<Tone, number> = { white: 0, black: 0, red: 0.45 }

function speckCount(tone: Tone, area: number): number {
    return Math.round(SPECK_DENSITY[tone] * area)
}

function speckShape(random: () => number, tone: Tone) {
    return {
        r: 0.014 + 0.026 * random() ** 2,
        stretch: 1 + random() * 1.2,
        angle: random() * 180,
        alt: random() < ALT_SHARE[tone]
    }
}

type SpeckShape = ReturnType<typeof speckShape>
type Spot = [number, number]

// How many places each speck tries before it settles in the one with the most room round it
// (best-candidate sampling), so flecks spread evenly, with no bare patches and no clumps, yet in
// no pattern.
const SPREAD = 10
// Only specks within NEAR of a place are looked at, kept in a grid of cells that size.
const NEAR = 0.15

// Places `count` specks of a colour, each shaped first, then at the best of SPREAD places: the
// one whose edge is furthest from any placed speck's. Places are on a flat plane, as fractions of
// the radius.
function spread(
    count: number,
    tone: Tone,
    random: () => number,
    place: () => Spot
): (SpeckShape & { at: Spot })[] {
    const placed: (SpeckShape & { at: Spot })[] = []
    const cells = new Map<number, (SpeckShape & { at: Spot })[]>()
    // A cell's key, from its column and row; places never reach 50 cells from the middle.
    const cellKey = (column: number, row: number) => (column + 50) * 100 + row + 50
    for (let index = 0; index < count; index++) {
        const speck = speckShape(random, tone)
        const extent = speck.r * speck.stretch
        let best = place()
        let bestRoom = -Infinity
        for (let attempt = 0; attempt < SPREAD; attempt++) {
            const candidate = attempt === 0 ? best : place()
            // Beyond the cells round it, a speck is at least NEAR away.
            let room = NEAR - extent
            const column = Math.floor(candidate[0] / NEAR)
            const row = Math.floor(candidate[1] / NEAR)
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (const other of cells.get(cellKey(column + dx, row + dy)) ?? []) {
                        const gap =
                            Math.hypot(candidate[0] - other.at[0], candidate[1] - other.at[1]) -
                            extent -
                            other.r * other.stretch
                        if (gap < room) room = gap
                    }
                }
            }
            if (room > bestRoom) {
                bestRoom = room
                best = candidate
            }
        }
        const settled = { ...speck, at: best }
        placed.push(settled)
        const key = cellKey(Math.floor(best[0] / NEAR), Math.floor(best[1] / NEAR))
        const cell = cells.get(key)
        if (cell) cell.push(settled)
        else cells.set(key, [settled])
    }
    return placed
}

// Over the whole top, from the hole out to the edge; the drawing keeps each off the hole and the
// edge (specks.ts).
export function faceSpecks(tone: Tone, seed: number, holeRatio: number): Speck[] {
    const random = seededRandom(seed)
    const inner = holeRatio
    return spread(speckCount(tone, Math.PI * (1 - inner ** 2)), tone, random, () => {
        const angle = random() * Math.PI * 2
        const distance = Math.sqrt(inner ** 2 + (1 - inner ** 2) * random())
        return [Math.cos(angle) * distance, Math.sin(angle) * distance]
    }).map(({ at: [x, y], ...speck }) => ({ x, y, ...speck }))
}

// How far round the front half side specks reach, short of where the side is seen edge on.
const SIDE_REACH = 0.96

// The near half of the outer side, `thickness` of the radius tall: evenly round it, out to where
// it turns away at either side, and nearly its full height.
export function sideSpecks(tone: Tone, seed: number, thickness: number): SideSpeck[] {
    const random = seededRandom(seed ^ 0x5f3759df)
    return spread(speckCount(tone, Math.PI * thickness), tone, random, () => [
        (random() - 0.5) * Math.PI * SIDE_REACH,
        (0.05 + random() * 0.9) * thickness
    ]).map(({ at: [round, up], ...speck }) => ({ x: Math.sin(round), v: up / thickness, ...speck }))
}

// The far half of the hole's wall, the only half seen from above: evenly round it, short of its
// ends, where it turns edge on, and its rounded edges.
export function wallSpecks(
    tone: Tone,
    seed: number,
    holeRatio: number,
    thickness: number
): WallSpeck[] {
    const random = seededRandom(seed ^ 0x2545f491)
    const around = Math.PI * holeRatio
    return spread(speckCount(tone, around * thickness), tone, random, () => [
        (0.06 + random() * 0.88) * around,
        (0.2 + random() * 0.6) * thickness
    ]).map(({ at: [along, down], ...speck }) => ({
        turn: along / around,
        v: down / thickness,
        ...speck
    }))
}

export function seedOf(key: string): number {
    let hash = 2166136261
    for (const char of key) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    }
    return hash
}

export function pieceTone(piece: Piece, toneOfPlayer: (playerId: string) => Tone): Tone {
    return isDvonnPiece(piece) ? 'red' : toneOfPlayer(piece.playerId)
}
