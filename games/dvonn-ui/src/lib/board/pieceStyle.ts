import { Color } from '@tabletop/common'
import { isDvonnPiece, type Piece } from '@tabletop/dvonn'
import { seededRandom } from './random.js'

export type Tone = 'white' | 'black' | 'red'

export function toneOf(color: Color): Tone {
    return color === Color.Black ? 'black' : 'white'
}

// `wall` is the inside of the hole, in shadow; `seam` parts two pieces seen down it.
export type PieceStyle = {
    face: string
    side: string
    edge: string
    speck: string
    wall: string
    seam: string
}

// Flecked like the real pieces: white with black, black and red with white.
export const PIECE_STYLES: Record<Tone, PieceStyle> = {
    white: {
        face: '#eeece6',
        side: '#c8c5bc',
        edge: '#6f6c66',
        speck: '#1b1b1d',
        wall: '#c6c2b8',
        seam: '#6f6c66'
    },
    black: {
        face: '#1d1e21',
        side: '#0e0f11',
        edge: '#000000',
        speck: '#e9e7e1',
        wall: '#060607',
        seam: '#55555c'
    },
    red: {
        face: '#d8392b',
        side: '#c42d20',
        edge: '#5e130c',
        speck: '#f3ede6',
        wall: '#8a1d14',
        seam: '#3d0a06'
    }
}

// Positions and sizes are fractions of the piece's radius.
export type Speck = { x: number; y: number; r: number; stretch: number; angle: number }
// A speck on the side band: x across the width, v down the band.
export type SideSpeck = { x: number; v: number; r: number; stretch: number; angle: number }

// Black flecks on white read as sparser than white flecks on black, so white carries more.
const FACE_SPECKS: Record<Tone, number> = { white: 70, black: 45, red: 45 }
const SIDE_SPECKS = 10

function speckShape(random: () => number) {
    return {
        r: 0.014 + 0.026 * random() ** 2,
        stretch: 1 + random() * 1.2,
        angle: random() * 180
    }
}

export function faceSpecks(tone: Tone, seed: number, holeRatio: number): Speck[] {
    const random = seededRandom(seed)
    const inner = holeRatio + 0.05
    const outer = 0.95
    return Array.from({ length: FACE_SPECKS[tone] }, () => {
        const angle = random() * Math.PI * 2
        const distance = Math.sqrt(inner ** 2 + (outer ** 2 - inner ** 2) * random())
        return {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            ...speckShape(random)
        }
    })
}

export function sideSpecks(seed: number): SideSpeck[] {
    const random = seededRandom(seed ^ 0x5f3759df)
    return Array.from({ length: SIDE_SPECKS }, () => ({
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

export function pieceTone(piece: Piece, toneOfPlayer: (playerId: string) => Tone): Tone {
    return isDvonnPiece(piece) ? 'red' : toneOfPlayer(piece.playerId)
}
