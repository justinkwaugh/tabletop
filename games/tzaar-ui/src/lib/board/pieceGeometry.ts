// Every size is in board units, where neighbouring spaces are SPACING_UNIT apart. Neighbours up a
// column are the tightest pair: their footprints touch at half the spacing.
export const SPACING_UNIT = 60
export const PIECE_RADIUS = SPACING_UNIT * 0.47

// The board is seen from the near side of the table: depth shrinks to TILT of its length, and
// heights show at RISE of theirs.
export const TILT = 0.75
export const RISE = Math.sqrt(1 - TILT ** 2)

// A piece's proportions, as fractions of its radius, as GIPF's and LYNGK's discs: each disc
// stands on the ring under it a `gap` above the disc below, and the bottom disc the same gap above
// the board, so a dark crease shows at each seam and under the stack. Past `cap` pieces a stack
// rises no higher; the pieces between its bottom and top thin out instead, so a tall stack does
// not bury the row behind it. The count on top says how many there are.
export type PieceModel = {
    thickness: number
    gap: number
    cap: number
}

export const PIECE_MODEL: PieceModel = {
    thickness: 0.2826,
    gap: 0.2826 * 0.32,
    cap: 5
}

// On the rotated board the nearest pieces behind a stack stand half a piece to either side, so a
// stack hides less of them and may rise higher.
export const ROTATED_PIECE_MODEL: PieceModel = { ...PIECE_MODEL, cap: 9 }

// A piece in a stack, on screen relative to the stack's space: where its underside is, and how
// tall its side shows. A `full` piece is drawn whole; the others are thinned bands.
export type Disc = { base: number; side: number; full: boolean }

// Each piece of a stack, bottom up.
export function stackDiscs(
    height: number,
    radius: number,
    model: PieceModel = PIECE_MODEL
): Disc[] {
    const side = model.thickness * radius * RISE
    const gap = model.gap * radius * RISE
    const pitch = side + gap
    if (height <= model.cap) {
        return Array.from({ length: height }, (_, index) => ({
            base: -(gap + index * pitch),
            side,
            full: true
        }))
    }
    // The bottom and top pieces stand where they would in a full-height stack; the pieces
    // between share the room left between them.
    const bottomTop = -(gap + side)
    const topBase = -(gap + (model.cap - 1) * pitch)
    const band = (bottomTop - topBase) / (height - 2)
    return [
        { base: -gap, side, full: true },
        ...Array.from({ length: height - 2 }, (_, index) => ({
            base: bottomTop - index * band,
            side: band,
            full: false
        })),
        { base: topBase, side, full: true }
    ]
}

// Where the rim of a stack's top piece is, relative to its space.
export function topFaceY(height: number, radius: number, model: PieceModel = PIECE_MODEL): number {
    const top = stackDiscs(Math.max(height, 1), radius, model).at(-1)
    return (top?.base ?? 0) - (top?.side ?? 0)
}

// How far a stack reaches above and below its space.
export function stackBounds(
    height: number,
    radius: number,
    model: PieceModel = PIECE_MODEL
): { top: number; bottom: number } {
    return {
        top: topFaceY(height, radius, model) - radius * TILT,
        bottom: radius * TILT
    }
}

// How far above its space a piece's underside rests, relative to where it would stand on the
// bare board, when it lies on a stack of `below` pieces drawn on their own.
export function restingLift(
    below: number,
    radius: number,
    model: PieceModel = PIECE_MODEL
): number {
    if (below === 0) return 0
    return topFaceY(below, radius, model)
}
