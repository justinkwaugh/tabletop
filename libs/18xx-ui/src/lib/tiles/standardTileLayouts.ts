import type { Point } from '@tabletop/common'
import type { TileLayout } from './tileDrawing.js'

/**
 * A point toward an edge (integer) or corner (half step) of the canonical flat hex, where edge 0
 * is at the bottom and positions run clockwise.
 */
export function towardTileEdge(position: number, distance: number): Point {
    const angle = ((90 + position * 60) * Math.PI) / 180
    return {
        x: Math.round(distance * Math.cos(angle) * 100) / 100,
        y: Math.round(distance * Math.sin(angle) * 100) / 100
    }
}

const cities = (first: Point, second: Point): TileLayout => ({
    nodePositions: { 'city-0': first, 'city-1': second }
})

export const StandardTileLayouts: Readonly<Record<string, TileLayout>> = {
    '18xx:55': { townTrackPositions: { 'town-0': 0.28, 'town-1': 0.72 } },
    '18xx:56': {
        townTrackPositions: { 'town-0': 0.28, 'town-1': 0.72 },
        revenuePositions: {
            'town-0': { x: 16, y: 16 * Math.sqrt(3) },
            'town-1': { x: 16, y: -16 * Math.sqrt(3) }
        }
    },
    '18xx:69': { townTrackPositions: { 'town-0': 0.3, 'town-1': 0.3 } },
    '18xx:54': cities(towardTileEdge(0.5, 22), towardTileEdge(2.5, 22)),
    '18xx:59': cities(towardTileEdge(0, 20), towardTileEdge(2, 20)),
    // Two-slot cities are wide, so they stay near the vertical axis.
    '18xx:62': cities({ x: -4, y: 21 }, { x: -4, y: -21 }),
    '18xx:64': cities(towardTileEdge(1, 15), towardTileEdge(3.5, 24)),
    '18xx:65': cities(towardTileEdge(5, 15), towardTileEdge(2.5, 24)),
    '18xx:66': cities(towardTileEdge(4.5, 6), towardTileEdge(1.5, 26)),
    '18xx:67': cities(towardTileEdge(0, 18), towardTileEdge(2, 22)),
    '18xx:68': cities(towardTileEdge(0, 18), towardTileEdge(4, 18))
}
