import type { TileLayout } from './tileDrawing.js'

export const StandardTileLayouts: Readonly<Record<string, TileLayout>> = {
    '18xx:56': {
        townTrackPositions: { 'town-0': 0.28, 'town-1': 0.72 },
        revenuePositions: {
            'town-0': { x: 16, y: 16 * Math.sqrt(3) },
            'town-1': { x: 16, y: -16 * Math.sqrt(3) }
        }
    }
}
