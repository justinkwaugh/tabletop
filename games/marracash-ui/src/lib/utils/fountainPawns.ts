import type { Point } from '@tabletop/common'

export const MaxPawnsShown = 9
export const FountainPawnSize = 18
export const FountainPawnSpacing: Point = {
    x: (FountainPawnSize * 10) / 9,
    y: (FountainPawnSize * 5) / 6
}

// Rows fill to a near-square, with any short row last. Every row sits on the half-step between
// the pawns of the row before it, so no pawn ever stands directly behind another; the whole
// cluster is then centred on the fountain.
function rowLengths(count: number): number[] {
    const columns = Math.ceil(Math.sqrt(count))
    const rows = Math.ceil(count / columns)
    return Array.from({ length: rows }, (_, row) => Math.min(columns, count - row * columns))
}

// The shift that puts a row's first pawn on its half-step lattice, choosing the smallest one and
// alternating the direction of ties so full rows go left, right, left rather than drifting
function rowShifts(lengths: number[], spacing: number): number[] {
    const firstX = (length: number) => (-(length - 1) / 2) * spacing
    const origin = firstX(lengths[0])
    let nextTie = 1
    return lengths.map((length, row) => {
        const target = origin + (row % 2) * (spacing / 2)
        const offset = (((firstX(length) - target) % spacing) + spacing) % spacing
        if (offset === 0) return 0
        if (offset === spacing / 2) {
            const shift = (nextTie * spacing) / 2
            nextTie = -nextTie
            return shift
        }
        return offset < spacing / 2 ? -offset : spacing - offset
    })
}

// Beyond MaxPawnsShown a fountain shows a per-colour tally at its centre instead.
export function fountainPawnPositions(count: number, center: Point): Point[] {
    if (count > MaxPawnsShown) return Array.from({ length: count }, () => center)
    const spacing = FountainPawnSpacing
    const lengths = rowLengths(count)
    const shifts = rowShifts(lengths, spacing.x)
    const placed = lengths.flatMap((length, row) =>
        Array.from({ length }, (_, col) => ({
            x: (col - (length - 1) / 2) * spacing.x + shifts[row],
            y: (row - (lengths.length - 1) / 2) * spacing.y
        }))
    )
    const xs = placed.map((point) => point.x)
    const middle = (Math.min(...xs) + Math.max(...xs)) / 2
    return placed.map((point) => ({ x: center.x + point.x - middle, y: center.y + point.y }))
}
