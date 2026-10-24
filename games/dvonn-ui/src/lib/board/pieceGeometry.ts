// Every size is in board units, where neighbouring spaces are SPACING_UNIT apart. Neighbours in
// a row are the tightest pair.
export const SPACING_UNIT = 60
export const PIECE_RADIUS = SPACING_UNIT * 0.47
export const HOLE_RATIO = 0.4

// A stack is drawn as discs seen at an angle: each face is an ellipse, with a band of the
// disc's side showing below it, so every color in the stack reads. The bottom disc stays on its
// space as the stack grows.
export const TILT = 0.72
export const SIDE = 0.2

// Past this many pieces a stack rises no higher; its discs thin out instead, so a tall stack
// does not bury the row behind it. The count on top says how many there are.
export const FULL_HEIGHT_PIECES = 10
// A DVONN piece keeps most of its thickness in a thinned stack, so it still stands out.
export const PROMINENT_SIDE = 0.8

export type Disc = { faceY: number; side: number }

// Each disc's band, bottom up. `prominent` marks the discs that keep their thickness.
export function stackDiscs(
    height: number,
    radius: number,
    prominent: readonly boolean[] = []
): Disc[] {
    const full = radius * SIDE
    const rise = full * (Math.min(height, FULL_HEIGHT_PIECES) - 1)
    const upper = Array.from({ length: Math.max(height - 1, 0) }, (_, index) => index + 1)
    const kept = height > FULL_HEIGHT_PIECES ? upper.filter((index) => prominent[index]) : []
    const keptSide = Math.min(full * PROMINENT_SIDE, rise / 2 / Math.max(kept.length, 1))
    const thinned = upper.length - kept.length
    const thinSide =
        height <= FULL_HEIGHT_PIECES ? full : (rise - kept.length * keptSide) / Math.max(thinned, 1)

    const discs: Disc[] = []
    let faceY = -full / 2
    for (let index = 0; index < height; index++) {
        const side = index === 0 ? full : kept.includes(index) ? keptSide : thinSide
        if (index > 0) faceY -= side
        discs.push({ faceY, side })
    }
    return discs
}

export function topFaceY(height: number, radius: number): number {
    return stackDiscs(Math.max(height, 1), radius).at(-1)?.faceY ?? 0
}

// How far a stack reaches above and below its space.
export function stackBounds(height: number, radius: number): { top: number; bottom: number } {
    return {
        top: topFaceY(height, radius) - radius * TILT,
        bottom: (radius * SIDE) / 2 + radius * TILT
    }
}
