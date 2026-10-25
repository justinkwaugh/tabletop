import { PieceColor } from '@tabletop/lyngk'
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
export type Speck = {
    x: number
    y: number
    r: number
    stretch: number
    angle: number
    alt: boolean
}

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
    const count = Math.round(FACE_SPECKS[color] * 0.25)
    return Array.from({ length: count }, () => ({
        x: (random() * 2 - 1) * 0.86,
        v: 0.15 + random() * 0.7,
        ...speckShape(random)
    }))
}

function speckShape(random: () => number) {
    return {
        alt: random() < 0.4,
        r: 0.02 + 0.035 * random() ** 2,
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
