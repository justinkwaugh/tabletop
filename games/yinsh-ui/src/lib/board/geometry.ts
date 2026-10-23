import { flatHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { DIRECTIONS, HEX_RADIUS, POINTS } from '@tabletop/yinsh'
import { RING_OUTER } from './pieceGeometry.js'

export const SPACING = 60
const FRAME_REACH = SPACING * 1.15
// Room below the bottom labels for the zoom controls, which sit in the bottom-left corner.
const CONTROLS_ROOM = SPACING * 0.6

const HEX_DIMENSIONS = { xRadius: SPACING / Math.sqrt(3), yRadius: SPACING / 2 }

export function pointCenter(coords: AxialCoordinates): Point {
    return flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
}

export function coordsKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}

const CORNERS: AxialCoordinates[] = DIRECTIONS.map((direction) => ({
    q: direction.q * HEX_RADIUS,
    r: direction.r * HEX_RADIUS
}))

// The grid's outer lines, clockwise: along each hexagon edge, then in to the point inside each
// missing corner and out again, so the play area ends where the lines do.
export function boardOutline(): string {
    return CORNERS.flatMap((corner, index) => {
        const previous = CORNERS[(index + CORNERS.length - 1) % CORNERS.length]
        const next = CORNERS[(index + 1) % CORNERS.length]
        const toward = (other: AxialCoordinates) => ({
            q: corner.q + (other.q - corner.q) / HEX_RADIUS,
            r: corner.r + (other.r - corner.r) / HEX_RADIUS
        })
        const inside = {
            q: (corner.q * (HEX_RADIUS - 1)) / HEX_RADIUS,
            r: (corner.r * (HEX_RADIUS - 1)) / HEX_RADIUS
        }
        return [toward(previous), inside, toward(next)]
    })
        .map((coords) => {
            const point = pointCenter(coords)
            return `${point.x},${point.y}`
        })
        .join(' ')
}

const HALF_WIDTH =
    Math.max(...POINTS.map((coords) => Math.abs(pointCenter(coords).x))) + FRAME_REACH
const HALF_HEIGHT =
    Math.max(...POINTS.map((coords) => Math.abs(pointCenter(coords).y))) + FRAME_REACH

export function viewBox(): { viewBox: string; width: number; height: number } {
    return {
        viewBox: `${-HALF_WIDTH} ${-HALF_HEIGHT} ${HALF_WIDTH * 2} ${HALF_HEIGHT * 2 + CONTROLS_ROOM}`,
        width: HALF_WIDTH * 2,
        height: HALF_HEIGHT * 2 + CONTROLS_ROOM
    }
}

// Rule G3: each player's three spaces for removed rings, in the empty corners beside the
// board: the top player's at the top left, the bottom player's at the bottom right. They run
// parallel to the hexagon's slanted edge, just beyond its labels: the line numbers at the top
// left, the column letters at the bottom right.
const SLOT_GAP = 4
const SLOT_LABEL_CLEARANCE = 22
const LABEL_REACH = SPACING * 0.6
const ALONG_EDGE = { x: Math.cos(Math.PI / 6), y: -Math.sin(Math.PI / 6) }
const OUTWARD = { x: -Math.sin(Math.PI / 6), y: -Math.cos(Math.PI / 6) }
const SLOT_OFFSET = RING_OUTER + SLOT_LABEL_CLEARANCE
// Measured along the edge from a label, so the spaces sit between labels rather than on them.
const SLOT_SHIFT = -SPACING * 0.7

// The 8 before C8, and the I below I4.
const LINE_8_LABEL = {
    x: pointCenter({ q: -3, r: -2 }).x - LABEL_REACH * Math.cos(Math.PI / 6),
    y: pointCenter({ q: -3, r: -2 }).y - LABEL_REACH * Math.sin(Math.PI / 6)
}
const COLUMN_I_LABEL = {
    x: pointCenter({ q: 3, r: 2 }).x,
    y: pointCenter({ q: 3, r: 2 }).y + LABEL_REACH
}

export function ringSlots(side: 'top' | 'bottom'): Point[] {
    const sign = side === 'top' ? 1 : -1
    const anchor = side === 'top' ? LINE_8_LABEL : COLUMN_I_LABEL
    const pitch = RING_OUTER * 2 + SLOT_GAP
    return [-1, 0, 1].map((offset) => {
        const along = SLOT_SHIFT + offset * pitch
        return {
            x: anchor.x + sign * (OUTWARD.x * SLOT_OFFSET + ALONG_EDGE.x * along),
            y: anchor.y + sign * (OUTWARD.y * SLOT_OFFSET + ALONG_EDGE.y * along)
        }
    })
}
