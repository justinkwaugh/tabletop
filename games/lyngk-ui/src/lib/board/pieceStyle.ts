import { PieceColor } from '@tabletop/lyngk'
import { seededRandom } from './random.js'

export type PieceStyle = {
    face: string
    side: string
    edge: string
    groove: string
    bevel: string
    speck: string
    name: string
}

export const PIECE_STYLES: Record<PieceColor, PieceStyle> = {
    [PieceColor.Ivory]: {
        face: '#efe3c3',
        side: '#d2c39b',
        edge: '#8a7b55',
        groove: '#b9a97f',
        bevel: '#fbf4df',
        speck: '#1a1a1a',
        name: 'ivory'
    },
    [PieceColor.Blue]: {
        face: '#2f5fb8',
        side: '#234b93',
        edge: '#0f2450',
        groove: '#1f4389',
        bevel: '#4f7dd0',
        speck: '#0b0b0e',
        name: 'blue'
    },
    [PieceColor.Red]: {
        face: '#d0352a',
        side: '#a9271f',
        edge: '#55100b',
        groove: '#a2241c',
        bevel: '#e45a4e',
        speck: '#120808',
        name: 'red'
    },
    [PieceColor.Green]: {
        face: '#1f9a5c',
        side: '#177a48',
        edge: '#063a20',
        groove: '#137443',
        bevel: '#3cb878',
        speck: '#07120c',
        name: 'green'
    },
    [PieceColor.Black]: {
        face: '#1d1e21',
        side: '#121315',
        edge: '#000000',
        groove: '#060607',
        bevel: '#3a3c41',
        speck: '#ecebe6',
        name: 'black'
    },
    [PieceColor.Joker]: {
        face: '#fbfbf9',
        side: '#e6e5e1',
        edge: '#7d7b76',
        groove: '#cfcdc8',
        bevel: '#ffffff',
        speck: '#151515',
        name: 'joker'
    }
}

// Like ZÈRTZ's marbles: the mottled jokers are densely flecked with black, the colored pieces
// only lightly, and black with a little white.
const FACE_SPECKS: Record<PieceColor, number> = {
    [PieceColor.Ivory]: 16,
    [PieceColor.Blue]: 16,
    [PieceColor.Red]: 16,
    [PieceColor.Green]: 16,
    [PieceColor.Black]: 14,
    [PieceColor.Joker]: 190
}

// Positions and sizes are fractions of the radius; y is before the tilt is applied.
export type Speck = { x: number; y: number; r: number; stretch: number; angle: number }

export function faceSpecks(color: PieceColor, seed: number): Speck[] {
    const random = seededRandom(seed)
    return Array.from({ length: FACE_SPECKS[color] }, () => {
        const angle = random() * Math.PI * 2
        const distance = 0.93 * Math.sqrt(random())
        return {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            ...speckShape(random)
        }
    })
}

// Specks on the visible side band: x across the width, v down the band from its top edge.
export type SideSpeck = { x: number; v: number; r: number; stretch: number; angle: number }

export function sideSpecks(color: PieceColor, seed: number): SideSpeck[] {
    const random = seededRandom(seed * 31 + 7)
    const count = Math.round(FACE_SPECKS[color] * 0.25)
    return Array.from({ length: count }, () => ({
        x: (random() * 2 - 1) * 0.94,
        v: 0.15 + random() * 0.7,
        ...speckShape(random)
    }))
}

function speckShape(random: () => number) {
    return {
        r: 0.02 + 0.035 * random() ** 2,
        stretch: 1 + random() * 1.2,
        angle: random() * 180
    }
}

// A piece's specks follow its point and level, so a stack in flight is seeded for where it
// lands and looks the same once it is down.
export function pieceSeed(pointKey: string, level: number, color: PieceColor): number {
    let hash = 2166136261
    for (const char of `${pointKey}|${level}|${color}`) {
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    }
    return hash
}
