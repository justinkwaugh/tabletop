import { flatHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { DIRECTIONS, HEX_RADIUS, POINTS } from '@tabletop/yinsh'
import { RING_HEIGHT, RING_OUTER } from './pieceGeometry.js'

export const SPACING = 60
// From the outermost labels and ring spaces to the frame's edge.
const FRAME_MARGIN = SPACING * 0.3
// Room below the bottom labels for the zoom controls, which sit in the bottom-left corner.
const CONTROLS_ROOM = SPACING * 0.6
// Beyond the silhouette of a ring on an outer point, to the centre of its coordinate label.
const LABEL_GAP = SPACING * 0.2
// Half a label's size, for the frame.
const LABEL_HALF = { x: 10, y: 8 }

// The board is seen from the near side of the table: depth shrinks to TILT of its length, and
// heights show at the matching fraction.
export const TILT = 0.75

const HEX_DIMENSIONS = { xRadius: SPACING / Math.sqrt(3), yRadius: SPACING / 2 }

// A point's centre on the board's own plane, as if seen straight down.
export function flatCenter(coords: AxialCoordinates): Point {
    return flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
}

export class BoardView {
    // How much of a height shows on screen.
    readonly rise: number

    constructor(readonly tilt: number) {
        this.rise = Math.sqrt(1 - tilt ** 2)
    }

    // A point on the board's plane, on screen.
    project(point: Point): Point {
        return { x: point.x, y: point.y * this.tilt }
    }

    // The centre of a point on the board's surface, where a piece standing there rests.
    center(coords: AxialCoordinates): Point {
        return this.project(flatCenter(coords))
    }

    // How far up the screen a height above the board shows.
    height(height: number): number {
        return height * this.rise
    }

    // How far from a point's centre a ring standing there reaches on screen, along a direction
    // on screen: the farther of its base and its raised top.
    ringReach(direction: Point): number {
        const length = Math.hypot(direction.x, direction.y)
        const ux = direction.x / length
        const uy = direction.y / length
        const rx = RING_OUTER
        const ry = RING_OUTER * this.tilt
        // Where a ray from the centre leaves an ellipse centred `lift` above it.
        const exit = (lift: number) => {
            const a = (ux / rx) ** 2 + (uy / ry) ** 2
            const b = (2 * uy * lift) / ry ** 2
            const c = (lift / ry) ** 2 - 1
            return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
        }
        return Math.max(exit(0), exit(this.height(RING_HEIGHT)))
    }

    // A label beside an outer point, in the direction of a neighbour it does not have, a gap
    // beyond a ring standing there.
    labelBeside(coords: AxialCoordinates, toward: AxialCoordinates): Point {
        const from = this.center(coords)
        const to = this.center(toward)
        const direction = { x: to.x - from.x, y: to.y - from.y }
        const length = Math.hypot(direction.x, direction.y)
        const reach = this.ringReach(direction) + LABEL_GAP
        return {
            x: from.x + (direction.x / length) * reach,
            y: from.y + (direction.y / length) * reach
        }
    }

    // The playing surface ends at the grid's outer lines.
    playAreaOutline(): string {
        return gridOutline()
            .map((coords) => {
                const point = this.center(coords)
                return `${point.x},${point.y}`
            })
            .join(' ')
    }

    // Rule G3: each player's three spaces for removed rings, in the empty corners beside the
    // board: the top player's at the top left, the bottom player's at the bottom right. They lie
    // on the board's plane and run parallel to the hexagon's slanted edge, just beyond its
    // labels: the line numbers at the top left, the column letters at the bottom right.
    ringSlots(side: 'top' | 'bottom'): Point[] {
        return flatRingSlots(side).map((point) => this.project(point))
    }

    // Everything the board draws: the points with a ring standing on each, the labels and the
    // ring spaces, with room for the zoom controls below.
    frame(labels: readonly Point[]): { viewBox: string; width: number; height: number } {
        const ringTop = this.height(RING_HEIGHT) + RING_OUTER * this.tilt
        const ringBottom = RING_OUTER * this.tilt
        const standing = (at: Point) => ({
            left: at.x - RING_OUTER,
            right: at.x + RING_OUTER,
            top: at.y - ringTop,
            bottom: at.y + ringBottom
        })
        const board = [
            ...POINTS.map((coords) => standing(this.center(coords))),
            ...labels.map((at) => ({
                left: at.x - LABEL_HALF.x,
                right: at.x + LABEL_HALF.x,
                top: at.y - LABEL_HALF.y,
                bottom: at.y + LABEL_HALF.y
            }))
        ]
        const slots = (['top', 'bottom'] as const).flatMap((side) =>
            this.ringSlots(side).map(standing)
        )
        // Centred on the board. The ring spaces may reach a little past the sides, into the table:
        // on phones the board's width limits its size.
        const halfWidth =
            Math.max(...board.map((e) => Math.max(-e.left, e.right))) + FRAME_MARGIN
        const halfHeight =
            Math.max(...[...board, ...slots].map((e) => Math.max(-e.top, e.bottom))) +
            FRAME_MARGIN
        return {
            viewBox: `${-halfWidth} ${-halfHeight} ${halfWidth * 2} ${halfHeight * 2 + CONTROLS_ROOM}`,
            width: halfWidth * 2,
            height: halfHeight * 2 + CONTROLS_ROOM
        }
    }
}

export const VIEW = new BoardView(TILT)

export function coordsKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}

const CORNERS: AxialCoordinates[] = DIRECTIONS.map((direction) => ({
    q: direction.q * HEX_RADIUS,
    r: direction.r * HEX_RADIUS
}))

// The grid's outer lines, clockwise: along each hexagon edge, then in to the point inside each
// missing corner and out again, so the play area ends where the lines do.
function gridOutline(): AxialCoordinates[] {
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
}

const SLOT_GAP = 4
const SLOT_LABEL_CLEARANCE = 22
const LABEL_REACH = SPACING * 0.6
const ALONG_EDGE = { x: Math.cos(Math.PI / 6), y: -Math.sin(Math.PI / 6) }
const OUTWARD = { x: -Math.sin(Math.PI / 6), y: -Math.cos(Math.PI / 6) }
const SLOT_OFFSET = RING_OUTER + SLOT_LABEL_CLEARANCE
// Measured along the edge from a label, so the spaces sit between labels rather than on them,
// and the outermost stays inside the frame, which the game's column clips.
const SLOT_SHIFT = -SPACING * 0.62

// The 8 before C8, and the I below I4, on the board's plane.
const LINE_8_LABEL = {
    x: flatCenter({ q: -3, r: -2 }).x - LABEL_REACH * Math.cos(Math.PI / 6),
    y: flatCenter({ q: -3, r: -2 }).y - LABEL_REACH * Math.sin(Math.PI / 6)
}
const COLUMN_I_LABEL = {
    x: flatCenter({ q: 3, r: 2 }).x,
    y: flatCenter({ q: 3, r: 2 }).y + LABEL_REACH
}

function flatRingSlots(side: 'top' | 'bottom'): Point[] {
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
