import { flatHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { BOARD_RADIUS, PLAY_RADIUS } from '@tabletop/gipf'

export const SPACING = 60
export const PIECE_RADIUS = SPACING * 0.36
export const DOT_RADIUS = SPACING * 0.12
const BOARD_MARGIN = SPACING * 0.75
const LABEL_ROOM = SPACING * 0.95

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
    const halfWidth = Math.abs(corner.x) + BOARD_MARGIN + LABEL_ROOM
    const top = pointCenter({ q: 0, r: -BOARD_RADIUS })
    const halfHeight = Math.abs(top.y) + BOARD_MARGIN + LABEL_ROOM
    return {
        viewBox: `${-halfWidth} ${-halfHeight} ${halfWidth * 2} ${halfHeight * 2}`,
        width: halfWidth * 2,
        height: halfHeight * 2
    }
}
