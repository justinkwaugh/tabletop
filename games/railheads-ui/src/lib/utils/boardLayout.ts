import {
    HexOrientation,
    calculateHexGeometry,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'

// The Revenue Track runs around the board's edge like the printed board: 0 to 20 along the
// top, 20 to 50 down the right, 50 to 70 back along the bottom and 70 to 100 up the left.
export const TRACK_CELL = 42
export const BOARD_WIDTH = TRACK_CELL * 21
export const BOARD_HEIGHT = TRACK_CELL * 31

export const HEX_RADIUS = 36
const HALF_HEIGHT = (Math.sqrt(3) / 2) * HEX_RADIUS
const MAP_X = 54
const MAP_Y = 59

export function hexCenter(coords: AxialCoordinates): Point {
    const col = coords.q
    const row = 2 * coords.r + coords.q
    return {
        x: MAP_X + HEX_RADIUS + col * 1.5 * HEX_RADIUS,
        y: MAP_Y + HALF_HEIGHT + row * HALF_HEIGHT
    }
}

export function hexPoints(center: Point, radius: number = HEX_RADIUS): string {
    return calculateHexGeometry(
        { orientation: HexOrientation.Flat, dimensions: { radius } },
        { q: 0, r: 0 }
    )
        .vertices.map((vertex) => `${center.x + vertex.x},${center.y + vertex.y}`)
        .join(' ')
}

// The top-left corner of the Revenue Track cell for a revenue, which wraps past 100.
export function revenueCell(revenue: number): Point {
    const step = ((revenue % 100) + 100) % 100
    if (step <= 20) return { x: step * TRACK_CELL, y: 0 }
    if (step <= 50) return { x: 20 * TRACK_CELL, y: (step - 20) * TRACK_CELL }
    if (step <= 70) return { x: (70 - step) * TRACK_CELL, y: 30 * TRACK_CELL }
    return { x: 0, y: (100 - step) * TRACK_CELL }
}

export const DEVELOPMENT_RECT = { x: 48, y: 52, width: 208, height: 212 }
export const LEGEND_RECT = { x: 510, y: 50, width: 330, height: 114 }
