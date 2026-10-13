import type { BoundingBox, Point } from '@tabletop/common'
import { boxHolds } from '$lib/utils/boundingBox.js'
import { BOARD_HEIGHT, BOARD_WIDTH } from './boardGeometry.js'

const MAP_FILE_WIDTH = 2448

export const MAP_FILE_SCALE = BOARD_WIDTH / MAP_FILE_WIDTH

export function mapFilePoint(x: number, y: number): Point {
    return { x: x * MAP_FILE_SCALE, y: y * MAP_FILE_SCALE }
}

interface MapFileArea {
    left: number
    top: number
    right: number
    bottom: number
}

const FIELD: MapFileArea = { left: 43, top: 39, right: 2404, bottom: 3125 }

// Measured on the designer's public map file: the title, the order-of-battle strips and the tracks. They must not overlap, because the even-odd rule cuts them out of the field.
const COVERED: MapFileArea[] = [
    { left: FIELD.left, top: FIELD.top, right: 682.5, bottom: 466.5 },
    { left: FIELD.left, top: 601, right: 133, bottom: 1619 },
    { left: 2311, top: 664, right: FIELD.right, bottom: 1908 },
    { left: FIELD.left, top: 2896, right: 468.5, bottom: FIELD.bottom },
    { left: 1978.5, top: 2550.5, right: FIELD.right, bottom: 2781 },
    { left: 1784, top: 2781, right: FIELD.right, bottom: 2987 },
    { left: 1662.5, top: 2987, right: FIELD.right, bottom: FIELD.bottom }
]

function outline({ left, top, right, bottom }: MapFileArea): string {
    return `M${left * MAP_FILE_SCALE} ${top * MAP_FILE_SCALE} H${right * MAP_FILE_SCALE} V${bottom * MAP_FILE_SCALE} H${left * MAP_FILE_SCALE} Z`
}

function onBoard({ left, top, right, bottom }: MapFileArea): BoundingBox {
    return {
        x: left * MAP_FILE_SCALE,
        y: top * MAP_FILE_SCALE,
        width: (right - left) * MAP_FILE_SCALE,
        height: (bottom - top) * MAP_FILE_SCALE
    }
}

/** The direction straight onto the board from a point on or near its edge. */
export function inwardsFromTheEdge(point: Point): Point {
    const edges = [
        { away: point.x, inwards: { x: 1, y: 0 } },
        { away: BOARD_WIDTH - point.x, inwards: { x: -1, y: 0 } },
        { away: point.y, inwards: { x: 0, y: 1 } },
        { away: BOARD_HEIGHT - point.y, inwards: { x: 0, y: -1 } }
    ]
    return edges.reduce((nearest, edge) => (edge.away < nearest.away ? edge : nearest)).inwards
}

export const BATTLEFIELD_EVEN_ODD_PATH = [outline(FIELD), ...COVERED.map(outline)].join(' ')

const FIELD_BOX = onBoard(FIELD)
const COVERED_BOXES = COVERED.map(onBoard)

export function onBattlefield(point: Point): boolean {
    return boxHolds(FIELD_BOX, point) && !COVERED_BOXES.some((box) => boxHolds(box, point))
}
