// A piece is drawn as discs seen slightly from above: each disc's face with its side showing
// below it. A GIPF-piece's top disc is the same size, raised on the lower one; the pieces
// taper underneath, so a dark band of the lower disc's face shows between the two edges.
// Everything is laid out so the visible stack is centred on the piece's point, which keeps
// selection rings even all the way round.

// The ring on a GIPF-piece's top face, as a fraction of its radius.
export const CROWN_SCALE = 0.55

export type Disc = { faceY: number; sideY: number; covered: boolean }

const SIDE = 0.14
const RAISE = SIDE * 1.8

export function pieceDiscs(gipf: boolean, radius: number): Disc[] {
    const side = radius * SIDE
    if (!gipf) {
        return [{ faceY: -side / 2, sideY: side / 2, covered: false }]
    }
    const raise = radius * RAISE
    const lower = (raise - side) / 2
    return [
        { faceY: lower, sideY: lower + side, covered: true },
        { faceY: lower - raise, sideY: lower - raise + side, covered: false }
    ]
}

// Half the height of the visible stack, for rings drawn around the piece.
export function pieceExtent(gipf: boolean, radius: number): number {
    const discs = pieceDiscs(gipf, radius)
    const top = Math.min(...discs.map((disc) => disc.faceY)) - radius
    const bottom = Math.max(...discs.map((disc) => disc.sideY)) + radius
    return (bottom - top) / 2
}

// Where the top face of a piece is centred, relative to its point.
export function topFaceY(gipf: boolean, radius: number): number {
    const discs = pieceDiscs(gipf, radius)
    return discs[discs.length - 1].faceY
}
