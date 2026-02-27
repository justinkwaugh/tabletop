import type { Point } from '@tabletop/common'
import { SEA_SHIP_MARKER_POSITIONS } from '$lib/definitions/seaShipMarkerPositions.js'

export function layoutCountForShipCount(shipCount: number): 1 | 2 | 3 {
    if (shipCount <= 1) {
        return 1
    }
    if (shipCount === 2) {
        return 2
    }
    return 3
}

export function markerPointsForSeaAreaShipList(seaAreaId: string, ships: readonly string[]): Point[] {
    if (ships.length === 0) {
        return []
    }

    const layout = SEA_SHIP_MARKER_POSITIONS[seaAreaId]
    if (!layout) {
        return []
    }

    const points = layout[layoutCountForShipCount(ships.length)]
    const markerCount = Math.min(ships.length, points.length)
    return points.slice(0, markerCount)
}
