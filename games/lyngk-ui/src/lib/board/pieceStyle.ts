import { PieceColor } from '@tabletop/lyngk'
import { THICKNESS } from './pieceGeometry.js'
import { seededRandom } from './random.js'

export type PieceStyle = {
    face: string
    edge: string
    bevel: string
    speck: string
    // A second fleck color, mixed in among the first (the jokers' grey).
    speckAlt?: string
    name: string
}

export const PIECE_STYLES: Record<PieceColor, PieceStyle> = {
    [PieceColor.Ivory]: {
        face: '#ece2c9',
        edge: '#877a5a',
        bevel: '#f9f3e3',
        speck: '#1a1a1a',
        name: 'ivory'
    },
    [PieceColor.Blue]: {
        face: '#2357ad',
        edge: '#0a1f4d',
        bevel: '#4475c9',
        speck: '#0b0b0e',
        name: 'blue'
    },
    [PieceColor.Red]: {
        face: '#cc2e28',
        edge: '#520e0a',
        bevel: '#e0544a',
        speck: '#120808',
        name: 'red'
    },
    [PieceColor.Green]: {
        face: '#178c58',
        edge: '#04341c',
        bevel: '#33a873',
        speck: '#07120c',
        name: 'green'
    },
    [PieceColor.Black]: {
        face: '#1d1e21',
        edge: '#000000',
        bevel: '#3a3c41',
        speck: '#ecebe6',
        name: 'black'
    },
    [PieceColor.Joker]: {
        face: '#fbfbf9',
        edge: '#7d7b76',
        bevel: '#ffffff',
        speck: '#151515',
        speckAlt: '#8e8e8b',
        name: 'joker'
    }
}

// Like ZÈRTZ's marbles: the mottled jokers are densely flecked with black and grey, far more than
// any other piece, the colored pieces lightly, and black with a little white.
const FACE_SPECKS: Record<PieceColor, number> = {
    [PieceColor.Ivory]: 35,
    [PieceColor.Blue]: 35,
    [PieceColor.Red]: 35,
    [PieceColor.Green]: 35,
    [PieceColor.Black]: 32,
    [PieceColor.Joker]: 640
}

// How large each piece's specks are against the usual: the jokers' smaller, packed close.
const SPECK_SIZE: Record<PieceColor, number> = {
    [PieceColor.Ivory]: 0.9,
    [PieceColor.Blue]: 0.9,
    [PieceColor.Red]: 0.9,
    [PieceColor.Green]: 0.9,
    [PieceColor.Black]: 0.9,
    [PieceColor.Joker]: 0.6
}

// Positions and sizes are fractions of the radius; y is before the tilt is applied.
export type Speck = {
    x: number
    y: number
    r: number
    stretch: number
    angle: number
    alt: boolean
}

// How many places each speck tries before it settles in the one with the most room round it
// (best-candidate sampling): specks spread evenly, with no bare patches and no clumps, yet in no
// pattern. The jokers' are only worked out when their looks are pre-rendered; other pieces' once
// each in the game (board/specks.ts).
const SPREAD = 10

type SpeckShape = ReturnType<typeof speckShape>
type Spot = [number, number]

// Places `count` specks, each shaped first, then at the best of `tries` places: the one whose
// edge is furthest from any placed speck's. Places are on a flat plane, as fractions of the
// radius; only specks within NEAR of a place are looked at, kept in a grid of cells that size.
const NEAR = 0.15

function spread(
    count: number,
    tries: number,
    shape: () => SpeckShape,
    place: () => Spot
): (SpeckShape & { at: Spot })[] {
    const placed: (SpeckShape & { at: Spot })[] = []
    const cells = new Map<number, (SpeckShape & { at: Spot })[]>()
    // A cell's key, from its column and row; places never reach 50 cells from the middle.
    const cellKey = (column: number, row: number) => (column + 50) * 100 + row + 50
    for (let index = 0; index < count; index++) {
        const speck = shape()
        const extent = speck.r * speck.stretch
        let best = place()
        let bestRoom = -Infinity
        for (let attempt = 0; attempt < tries; attempt++) {
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

export function faceSpecks(color: PieceColor, seed: number): Speck[] {
    const random = seededRandom(seed)
    return spread(
        FACE_SPECKS[color],
        SPREAD,
        () => speckShape(random, SPECK_SIZE[color]),
        () => {
            const angle = random() * Math.PI * 2
            const distance = Math.sqrt(random())
            return [Math.cos(angle) * distance, Math.sin(angle) * distance]
        }
    ).map(({ at: [x, y], ...speck }) => ({ x, y, ...speck }))
}

// How far round the front half side specks reach, short of where the side is seen edge on.
const SIDE_REACH = 0.96

// Specks on the visible side band: x across the width, v down the band from its top edge.
export type SideSpeck = {
    x: number
    v: number
    r: number
    stretch: number
    angle: number
    alt: boolean
}

export function sideSpecks(color: PieceColor, seed: number): SideSpeck[] {
    const random = seededRandom(seed * 31 + 7)
    return spread(
        Math.round(FACE_SPECKS[color] * 0.25),
        SPREAD,
        () => speckShape(random, SPECK_SIZE[color]),
        // Round the side and up it, as fractions of the radius: evenly round the whole front half,
        // out to where it turns away at either side, and nearly the full height; the outline's
        // clip trims any that reach past it.
        () => [(random() - 0.5) * Math.PI * SIDE_REACH, (0.05 + random() * 0.9) * THICKNESS]
    ).map(({ at: [round, up], ...speck }) => ({
        x: Math.sin(round),
        v: up / THICKNESS,
        ...speck
    }))
}

function speckShape(random: () => number, size: number) {
    return {
        alt: random() < 0.4,
        r: (0.02 + 0.035 * random() ** 2) * size,
        stretch: 1 + random() * 1.2,
        angle: random() * 180
    }
}

// A piece's specks follow the piece, named by the point it was dealt to, so they stay put as it
// moves. A board without identities (a game from before they were kept) seeds them by point and
// level instead, and a stack in flight for where it lands, so it looks the same once it is down.
export function pieceSeed(
    id: number | undefined,
    pointKey: string,
    level: number,
    color: PieceColor
) {
    return hashed(id === undefined ? `${pointKey}|${level}|${color}` : `piece|${id}`)
}

function hashed(text: string): number {
    let hash = 2166136261
    for (const char of text) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    }
    return hash
}
