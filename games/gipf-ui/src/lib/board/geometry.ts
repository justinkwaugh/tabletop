import { flatHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { BOARD_RADIUS, PLAY_RADIUS } from '@tabletop/gipf'

export const SPACING = 60
// As large as possible while two GIPF-pieces in neighbouring spots just touch.
export const PIECE_RADIUS = SPACING * 0.428
export const DOT_RADIUS = SPACING * 0.12
// From the outermost dots to the frame's edge: room for the coordinate labels and a margin
// like ZÈRTZ's beyond them.
const FRAME_REACH = SPACING * 1.1

const HEX_DIMENSIONS = { xRadius: SPACING / Math.sqrt(3), yRadius: SPACING / 2 }

export function pointCenter(coords: AxialCoordinates): Point {
    return flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
}

export function coordsKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}

// The play area's edge is the grid's outermost lines; the dots sit outside it on the table.
export function playAreaOutline(): string {
    const corners: AxialCoordinates[] = [
        { q: PLAY_RADIUS, r: -PLAY_RADIUS },
        { q: PLAY_RADIUS, r: 0 },
        { q: 0, r: PLAY_RADIUS },
        { q: -PLAY_RADIUS, r: PLAY_RADIUS },
        { q: -PLAY_RADIUS, r: 0 },
        { q: 0, r: -PLAY_RADIUS }
    ]
    return corners
        .map((corner) => {
            const point = pointCenter(corner)
            return `${point.x},${point.y}`
        })
        .join(' ')
}

export function viewBox(): { viewBox: string; width: number; height: number } {
    const corner = pointCenter({ q: BOARD_RADIUS, r: -BOARD_RADIUS })
    const halfWidth = Math.abs(corner.x) + FRAME_REACH
    const top = pointCenter({ q: 0, r: -BOARD_RADIUS })
    const halfHeight = Math.abs(top.y) + FRAME_REACH
    return {
        viewBox: `${-halfWidth} ${-halfHeight} ${halfWidth * 2} ${halfHeight * 2}`,
        width: halfWidth * 2,
        height: halfHeight * 2
    }
}
