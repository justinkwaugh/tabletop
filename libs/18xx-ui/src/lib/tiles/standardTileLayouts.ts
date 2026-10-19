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

const cities = (
    first: Point,
    second: Point,
    annotations: Omit<TileLayout, 'nodePositions'> = {}
): TileLayout => ({
    nodePositions: { 'city-0': first, 'city-1': second },
    ...annotations
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
    '18xx:2': { revenuePositions: { 'town-1': { x: -13, y: 26 } } },
    '18xx:69': {
        townTrackPositions: { 'town-0': 0.3, 'town-1': 0.3 },
        revenuePositions: { 'town-0': { x: 18.9, y: 16.8 }, 'town-1': { x: -20, y: -31 } }
    },
    '18xx:54': cities(towardTileEdge(0.5, 22), towardTileEdge(2.5, 22), {
        revenuePositions: { 'city-0': { x: 17, y: 29.4 }, 'city-1': { x: 19.7, y: -21.8 } },
        labelPosition: { x: 32.7, y: 0.7 }
    }),
    '18xx:59': cities(towardTileEdge(0, 20), towardTileEdge(2, 20), {
        revenuePositions: { 'city-0': { x: 31, y: 9.8 }, 'city-1': { x: 7, y: -31.8 } },
        labelPosition: { x: 20.8, y: -12 }
    }),
    // Two-slot cities are wide, so they stay near the vertical axis. That leaves room for the
    // label on one side and one revenue on the other, so the cities' shared revenue shows once.
    '18xx:62': cities(
        { x: -4, y: 21 },
        { x: -4, y: -21 },
        {
            hideRevenue: ['city-1'],
            revenuePositions: { 'city-0': { x: -34.7, y: -0.2 } },
            labelPosition: { x: 32.1, y: -2.4 }
        }
    ),
    '18xx:64': cities(towardTileEdge(1, 15), towardTileEdge(3.5, 24)),
    '18xx:65': cities(towardTileEdge(5, 15), towardTileEdge(2.5, 24)),
    '18xx:66': cities(towardTileEdge(4.5, 6), towardTileEdge(1.5, 26)),
    '18xx:67': cities(towardTileEdge(0, 18), towardTileEdge(2, 22), {
        revenuePositions: { 'city-0': { x: -27.6, y: 18.2 }, 'city-1': { x: 15.7, y: -28.7 } },
        labelPosition: { x: 30.8, y: 5.3 }
    }),
    '18xx:68': cities(towardTileEdge(0, 18), towardTileEdge(4, 18))
}
