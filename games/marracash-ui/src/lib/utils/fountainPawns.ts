import type { Point } from '@tabletop/common'
import { clusterPositions } from '$lib/utils/boardGeometry.js'

export const MaxPawnsShown = 9
export const FountainPawnSize = 18
export const FountainPawnSpacing: Point = { x: 20, y: 15 }

// Beyond MaxPawnsShown a fountain shows a per-colour tally at its centre instead.
export function fountainPawnPositions(count: number, center: Point): Point[] {
    return count > MaxPawnsShown
        ? Array.from({ length: count }, () => center)
        : clusterPositions(count, center, FountainPawnSpacing)
}
