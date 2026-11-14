import {
    flatHexCoordsToCenterPoint,
    sameCoordinates,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { layoutCoordinates, SETUP_RULES, type ZertzSetup } from '@tabletop/zertz'

export const RING_SPACING = 64
// Neighbouring rings touch, as they do on the table.
export const RING_OUTER_RADIUS = RING_SPACING / 2
export const RING_INNER_RADIUS = RING_SPACING * 0.2
export const RING_WIDTH = RING_OUTER_RADIUS - RING_INNER_RADIUS
export const RING_MID_RADIUS = (RING_OUTER_RADIUS + RING_INNER_RADIUS) / 2
export const MARBLE_RADIUS = RING_SPACING * 0.31
export const LABEL_GAP = RING_SPACING * 0.22
const LABEL_HALF_HEIGHT = 9
const FRAME_MARGIN = RING_SPACING * 0.1
// Room for the zoom controls and board toggles in the bottom corners.
const CONTROLS_ROOM = RING_SPACING * 0.2

const RING_HEIGHT = RING_SPACING * 0.155
const SHELL_THICKNESS = RING_SPACING * 0.045
const MARBLE_RISE = Math.sqrt(MARBLE_RADIUS ** 2 - RING_INNER_RADIUS ** 2)

// Depth shrinks to TILT of its length, and heights show at the matching fraction.
export const TILT = 0.75

const HEX_DIMENSIONS = { xRadius: RING_SPACING / Math.sqrt(3), yRadius: RING_SPACING / 2 }

export type BoardFrame = {
    positions: AxialCoordinates[]
    viewBox: string
    width: number
    height: number
}

export class BoardView {
    readonly tilt = TILT
    readonly band: number
    readonly rimEdge: number
    readonly lift: number

    constructor(readonly turned = false) {
        const rise = Math.sqrt(1 - this.tilt ** 2)
        this.band = RING_HEIGHT * rise
        this.rimEdge = SHELL_THICKNESS * rise
        this.lift = MARBLE_RISE * rise
    }

    get extentAbove(): number {
        return Math.max(RING_OUTER_RADIUS * this.tilt, this.lift + MARBLE_RADIUS)
    }

    get extentBelow(): number {
        return RING_OUTER_RADIUS * this.tilt + this.band
    }

    center(coords: AxialCoordinates): Point {
        const point = flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
        const sign = this.turned ? -1 : 1
        return { x: sign * point.x, y: sign * point.y * this.tilt }
    }

    frame(setup: ZertzSetup): BoardFrame {
        const positions = layoutCoordinates(SETUP_RULES[setup].board)
        const centers = positions.map((coords) => this.center(coords))
        const reach = RING_OUTER_RADIUS + FRAME_MARGIN
        const labelRoom = LABEL_GAP + LABEL_HALF_HEIGHT + FRAME_MARGIN
        const minX = Math.min(...centers.map((point) => point.x)) - reach
        const maxX = Math.max(...centers.map((point) => point.x)) + reach
        const minY = Math.min(...centers.map((point) => point.y)) - this.extentAbove - labelRoom
        const maxY = Math.max(...centers.map((point) => point.y)) + this.extentBelow + labelRoom
        const width = maxX - minX
        const height = maxY - minY + CONTROLS_ROOM
        return { positions, viewBox: `${minX} ${minY} ${width} ${height}`, width, height }
    }
}

export const VIEW = new BoardView()
const TURNED_VIEW = new BoardView(true)

export function viewOf(turned: boolean): BoardView {
    return turned ? TURNED_VIEW : VIEW
}

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}
