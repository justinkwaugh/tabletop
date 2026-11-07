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

type SpeckShape = ReturnType<typeof speckShape>
type Spot = [number, number]

// How many places each speck tries before it settles in the one with the most room round it
// (best-candidate sampling), so flecks spread evenly, with no bare patches and no clumps, yet in
// no pattern.
const SPREAD = 10
// Only specks within NEAR of a place are looked at, kept in a grid of cells that size.
const NEAR = 0.15

// Places `count` specks, each shaped first, then at the best of SPREAD places: the one whose
// edge is furthest from any placed speck's. Places are on a flat plane, as fractions of the
// radius.
function spread(
    count: number,
    random: () => number,
    place: () => Spot
): (SpeckShape & { at: Spot })[] {
    const placed: (SpeckShape & { at: Spot })[] = []
    const cells = new Map<number, (SpeckShape & { at: Spot })[]>()
    // A cell's key, from its column and row; places never reach 50 cells from the middle.
    const cellKey = (column: number, row: number) => (column + 50) * 100 + row + 50
    for (let index = 0; index < count; index++) {
        const speck = speckShape(random)
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

// Over the whole top, out to the edge; the drawing keeps each off the lips and the edge, lowers
// those in the hollows to their floors and leaves out those on metal (specks.ts).
export function topSpecks(tone: Tone, seed: number): Speck[] {
    const random = seededRandom(seed)
    return spread(speckCount(tone, Math.PI), random, () => {
        const angle = random() * Math.PI * 2
        const distance = Math.sqrt(random())
        return [Math.cos(angle) * distance, Math.sin(angle) * distance]
    }).map(({ at: [x, y], ...speck }) => ({ x, y, ...speck }))
}

// A fleck on a top seen from a board turned `quarterTurns` quarter turns clockwise, as the board
// view turns the spaces.
export function turnSpeck(speck: Speck, quarterTurns: number): Speck {
    let { x, y } = speck
    for (let turn = 0; turn < quarterTurns % 4; turn++) [x, y] = [-y, x]
    return { ...speck, x, y, angle: speck.angle + 90 * quarterTurns }
}

// How far round the front half side specks reach, short of where the side is seen edge on.
const SIDE_REACH = 0.96

// The near half of the outer side, `thickness` of the radius tall: evenly round it, out to where
// it turns away at either side, and nearly its full height.
export function sideSpecks(tone: Tone, seed: number, thickness: number): SideSpeck[] {
    const random = seededRandom(seed ^ 0x5f3759df)
    return spread(speckCount(tone, Math.PI * thickness), random, () => [
        (random() - 0.5) * Math.PI * SIDE_REACH,
        (0.05 + random() * 0.9) * thickness
    ]).map(({ at: [round, up], ...speck }) => ({
        x: Math.sin(round),
        v: up / thickness,
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
