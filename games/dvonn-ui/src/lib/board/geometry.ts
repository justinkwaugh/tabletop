import { pointyHexCoordsToCenterPoint, type AxialCoordinates, type Point } from '@tabletop/common'
import { SPACES } from '@tabletop/dvonn'
import { boardLabels, type CoordinateLabel } from './coordinates.js'
import { FULL_HEIGHT_PIECES, PIECE_RADIUS, SPACING_UNIT, stackBounds } from './pieceGeometry.js'

export const SPACING = SPACING_UNIT

const HEX_DIMENSIONS = { xRadius: SPACING / 2, yRadius: SPACING / Math.sqrt(3) }

export function coordsKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}

// The six spaces at the corners of the board: both ends of the top, middle and bottom rows.
const CORNER_SPACES: readonly AxialCoordinates[] = [
    { q: -3, r: -2 },
    { q: 5, r: -2 },
    { q: 5, r: 0 },
    { q: 3, r: 2 },
    { q: -5, r: 2 },
    { q: -5, r: 0 }
]

// The sand board runs this far past the outer spaces, rounded at its corners.
export const SAND_MARGIN = SPACING * 0.62

const FRAME_REACH = SAND_MARGIN + SPACING * 0.5
// Room below the bottom labels for the zoom controls, which sit in the bottom-left corner.
const CONTROLS_ROOM = SPACING * 0.4

// Where everything on the board is drawn, in board units.
export class BoardLayout {
    readonly radius = PIECE_RADIUS
    readonly corners: readonly Point[]
    readonly hull: string
    readonly sandOutline: string
    readonly labels: CoordinateLabel[]
    readonly frame: { x: number; y: number; width: number; height: number }

    constructor() {
        this.corners = CORNER_SPACES.map((coords) => this.center(coords))
        this.hull = this.corners.map((point) => `${point.x},${point.y}`).join(' ')
        this.sandOutline = roundedOutline(this.corners, SAND_MARGIN)
        this.labels = boardLabels(SPACES, (coords) => this.center(coords))

        const centers = SPACES.map((coords) => this.center(coords))
        const halfWidth = Math.max(...centers.map((point) => Math.abs(point.x))) + FRAME_REACH
        const halfHeight = Math.max(...centers.map((point) => Math.abs(point.y))) + FRAME_REACH
        // A stack in the top row rises above the frame; leave room for it at its full height.
        const topRoom = -stackBounds(FULL_HEIGHT_PIECES, this.radius).top - this.radius
        this.frame = {
            x: -halfWidth,
            y: -halfHeight - topRoom,
            width: halfWidth * 2,
            height: halfHeight * 2 + topRoom + CONTROLS_ROOM
        }
    }

    center(coords: AxialCoordinates): Point {
        return pointyHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
    }

    get viewBox(): string {
        const { x, y, width, height } = this.frame
        return `${x} ${y} ${width} ${height}`
    }
}

export const LAYOUT = new BoardLayout()

// A convex outline, listed clockwise on screen, pushed out by `margin` with rounded corners.
export function roundedOutline(points: readonly Point[], margin: number): string {
    const normals = points.map((point, index) => {
        const next = points[(index + 1) % points.length]
        const length = Math.hypot(next.x - point.x, next.y - point.y)
        return { x: (next.y - point.y) / length, y: -(next.x - point.x) / length }
    })
    const offset = (point: Point, normal: Point) =>
        `${point.x + normal.x * margin} ${point.y + normal.y * margin}`
    return (
        points
            .map((point, index) => {
                const before = normals[(index + points.length - 1) % points.length]
                const after = normals[index]
                const next = points[(index + 1) % points.length]
                const start = index === 0 ? `M ${offset(point, before)} ` : ''
                return `${start}A ${margin} ${margin} 0 0 1 ${offset(point, after)} L ${offset(next, after)}`
            })
            .join(' ') + ' Z'
    )
}
