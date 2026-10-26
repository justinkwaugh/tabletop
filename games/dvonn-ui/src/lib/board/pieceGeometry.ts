// Every size is in board units, where neighbouring spaces are SPACING_UNIT apart. Neighbours in
// a row are the tightest pair.
export const SPACING_UNIT = 60
export const PIECE_RADIUS = SPACING_UNIT * 0.47

// The board is seen from the near side of the table: depth shrinks to TILT of its length, and
// heights show at RISE of theirs.
export const TILT = 0.75
export const RISE = Math.sqrt(1 - TILT ** 2)

// A piece's proportions, as fractions of its radius. The underside bulges down as far as the top
// is dished, so a piece nests in the one below it, its edges a `gap` above the lower one's, and
// stands on the board on its bulge, its edges `rise` above the board: a dark crease shows at each
// seam and under the stack. Past `cap` pieces a stack rises no higher; the pieces between its
// bottom and top thin out instead, so a tall stack does not bury the row behind it. The count on
// top says how many there are.
export type PieceModel = {
    thickness: number
    gap: number
    rise: number
    hole: number
    cap: number
}

export const PIECE_MODEL: PieceModel = {
    thickness: 0.2,
    gap: 0.05,
    rise: 0.2 * 0.3,
    hole: 0.34,
    cap: 13
}

// A DVONN piece keeps most of its thickness in a thinned stack, so it still stands out.
export const PROMINENT_SIDE = 0.8

// A piece in a stack, on screen relative to the stack's space: where its underside is, and how
// tall its side shows. A `full` piece is drawn whole; the others are thinned bands.
export type Disc = { base: number; side: number; full: boolean }

// Each piece of a stack, bottom up. `prominent` marks the pieces that keep their thickness when
// the stack is thinned.
export function stackDiscs(
    height: number,
    radius: number,
    prominent: readonly boolean[] = [],
    model: PieceModel = PIECE_MODEL
): Disc[] {
    const side = model.thickness * radius * RISE
    const gap = model.gap * radius * RISE
    const rise = model.rise * radius * RISE
    const pitch = side + gap
    if (height <= model.cap) {
        return Array.from({ length: height }, (_, index) => ({
            base: -(rise + index * pitch),
            side,
            full: true
        }))
    }
    // The bottom and top pieces stand where they would in a full-height stack; the pieces
    // between share the room left between them.
    const bottomTop = -(rise + side)
    const topBase = -(rise + (model.cap - 1) * pitch)
    const room = bottomTop - topBase
    const middle = Array.from({ length: height - 2 }, (_, index) => index + 1)
    const kept = middle.filter((index) => prominent[index])
    const keptSide = Math.min(pitch * PROMINENT_SIDE, room / 2 / Math.max(kept.length, 1))
    const thinSide = (room - kept.length * keptSide) / Math.max(middle.length - kept.length, 1)

    const discs: Disc[] = [{ base: -rise, side, full: true }]
    let base = bottomTop
    for (const index of middle) {
        const band = kept.includes(index) ? keptSide : thinSide
        discs.push({ base, side: band, full: false })
        base -= band
    }
    discs.push({ base: topBase, side, full: true })
    return discs
}

// Where the rim of a stack's top piece is, relative to its space.
export function topFaceY(height: number, radius: number, model: PieceModel = PIECE_MODEL): number {
    const top = stackDiscs(Math.max(height, 1), radius, [], model).at(-1)
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
export function restingLift(below: number, radius: number, model: PieceModel = PIECE_MODEL): number {
    if (below === 0) return 0
    return topFaceY(below, radius, model) - (model.gap - model.rise) * radius * RISE
}
