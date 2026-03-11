import type { Point } from '@tabletop/common'
import {
    SEA_SHIP_MARKER_POSITIONS,
    type SeaShipLayout,
    type SeaShipLayoutCount
} from '$lib/definitions/seaShipMarkerPositions.js'

export function layoutCountForShipCount(shipCount: number): SeaShipLayoutCount {
    if (shipCount <= 1) {
        return 1
    }
    if (shipCount === 2) {
        return 2
    }
    if (shipCount === 3) {
        return 3
    }
    return 4
}

function averagePoint(points: readonly Point[]): Point | null {
    if (points.length === 0) {
        return null
    }
    const total = points.reduce(
        (accumulator, point) => ({
            x: accumulator.x + point.x,
            y: accumulator.y + point.y
        }),
        { x: 0, y: 0 }
    )
    return {
        x: total.x / points.length,
        y: total.y / points.length
    }
}

function fallbackFourShipPoints(layout: SeaShipLayout): Point[] {
    const center = layout[1][0] ?? averagePoint(layout[3]) ?? averagePoint(layout[2])
    if (!center) {
        return []
    }

    return [
        { x: center.x - 28, y: center.y },
        { x: center.x, y: center.y - 22 },
        { x: center.x + 28, y: center.y },
        { x: center.x, y: center.y + 22 }
    ]
}

function markerPointsForLayoutCount(layout: SeaShipLayout, count: SeaShipLayoutCount): Point[] {
    if (count === 4) {
        return layout[4] ?? fallbackFourShipPoints(layout)
    }
    return layout[count]
}

export function markerPointsForSeaAreaShipList(seaAreaId: string, ships: readonly string[]): Point[] {
    if (ships.length === 0) {
        return []
    }

    const layout = SEA_SHIP_MARKER_POSITIONS[seaAreaId]
    if (!layout) {
        return []
    }

    const points = markerPointsForLayoutCount(layout, layoutCountForShipCount(ships.length))
    const markerCount = Math.min(ships.length, points.length)
    return points.slice(0, markerCount)
}
