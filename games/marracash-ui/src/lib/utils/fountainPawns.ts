import type { Point } from '@tabletop/common'
import { clusterPositions } from '$lib/utils/boardGeometry.js'

export const MaxPawnsShown = 9
export const FountainPawnSize = 18
export const FountainPawnSpacing: Point = {
    x: (FountainPawnSize * 10) / 9,
    y: (FountainPawnSize * 5) / 6
}
// When every row is full, neighbouring rows shift apart by the half spacing a centred short row
// already has, so pawns never stand directly behind one another
export const FountainRowStagger = FountainPawnSpacing.x / 2

// Beyond MaxPawnsShown a fountain shows a per-colour tally at its centre instead.
export function fountainPawnPositions(count: number, center: Point): Point[] {
    if (count > MaxPawnsShown) return Array.from({ length: count }, () => center)
    const positions = clusterPositions(count, center, FountainPawnSpacing)
    const columns = Math.ceil(Math.sqrt(count))
    const fullRows = count > columns && count % columns === 0
    if (!fullRows) return positions
    return positions.map((position, index) => {
        const row = Math.floor(index / columns)
        const side = row % 2 === 0 ? -1 : 1
        return { x: position.x + (side * FountainRowStagger) / 2, y: position.y }
    })
}
