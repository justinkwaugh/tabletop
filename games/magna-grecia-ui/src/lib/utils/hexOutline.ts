import type { AxialCoordinates, Point } from '@tabletop/common'
import { outerEdges } from './cityLayout.js'

function pointKey({ x, y }: Point): string {
    return `${Math.round(x * 100)},${Math.round(y * 100)}`
}

// Each hex's outer edges run clockwise, so the region's boundary chains end to start into
// closed loops: one around each group of touching hexes, and one around any hole inside it.
export function hexRegionOutlines(spaces: AxialCoordinates[]): Point[][] {
    const edgesFrom = new Map(outerEdges(spaces).map((edge) => [pointKey(edge.from), edge]))
    const loops: Point[][] = []
    for (const [startKey, start] of edgesFrom) {
        if (!edgesFrom.has(startKey)) {
            continue
        }
        const loop: Point[] = []
        let edge = start
        while (edgesFrom.delete(pointKey(edge.from))) {
            loop.push(edge.from)
            const next = edgesFrom.get(pointKey(edge.to))
            if (!next) {
                break
            }
            edge = next
        }
        loops.push(loop)
    }
    return loops
}
