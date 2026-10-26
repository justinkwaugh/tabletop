import {
    addAxial,
    pointyHexCoordsToCenterPoint,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { isSpace, SPACES } from '@tabletop/dvonn'
import { boardLabels, type CoordinateLabel } from './coordinates.js'
import { PIECE_MODEL, PIECE_RADIUS, SPACING_UNIT, stackBounds, TILT } from './pieceGeometry.js'

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
// Beyond the board's edge, on screen, to the centre of a coordinate label.
const LABEL_GAP = SPACING * 0.2
// Half a label's size, for the frame.
const LABEL_HALF = { x: 5, y: 8 }
// From the board's edge and the outermost labels to the frame's edge.
const FRAME_MARGIN = SPACING * 0.15
// Room below the bottom labels for the zoom controls, which sit in the bottom-left corner.
const CONTROLS_ROOM = SPACING * 0.4

// A space's centre on the board's own plane, as if seen straight down.
export function flatCenter(coords: AxialCoordinates): Point {
    return pointyHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
}

// Where everything on the board is drawn, in board units. The board is seen from the near side
// of the table: depth shrinks to `tilt` of its length, and heights show at `rise` of theirs.
// The board's edge lies `edge` past the outer spaces; the labels and the frame keep clear of it.
export class BoardView {
    readonly radius = PIECE_RADIUS
    readonly rise: number
    readonly hull: string
    readonly sandOutline: string
    readonly labels: CoordinateLabel[]
    readonly frame: { x: number; y: number; width: number; height: number }
    private readonly flatCorners: readonly Point[]

    constructor(
        readonly tilt: number,
        private readonly edge: number
    ) {
        this.rise = Math.sqrt(1 - tilt ** 2)
        this.flatCorners = CORNER_SPACES.map(flatCenter)
        this.hull = this.flatCorners
            .map((corner) => this.project(corner))
            .map((point) => `${point.x},${point.y}`)
            .join(' ')
        this.sandOutline = roundedOutline(this.flatCorners, SAND_MARGIN, tilt)
        this.labels = boardLabels(SPACES, (coords, toward) => this.labelBeside(coords, toward))

        // The board's edge, the labels, and a full-height stack standing in the top row.
        const board = this.flatCorners.flatMap((corner) =>
            [
                { x: corner.x - edge, y: corner.y - edge },
                { x: corner.x + edge, y: corner.y + edge }
            ].map((point) => this.project(point))
        )
        const labelCorners = this.labels.flatMap(({ at }) => [
            { x: at.x - LABEL_HALF.x, y: at.y - LABEL_HALF.y },
            { x: at.x + LABEL_HALF.x, y: at.y + LABEL_HALF.y }
        ])
        const topRow = Math.min(...SPACES.map((coords) => this.center(coords).y))
        const tallest = { x: 0, y: topRow + stackBounds(PIECE_MODEL.cap, this.radius).top }
        const extent = [...board, ...labelCorners, tallest]
        const left = Math.min(...extent.map((point) => point.x)) - FRAME_MARGIN
        const right = Math.max(...extent.map((point) => point.x)) + FRAME_MARGIN
        const top = Math.min(...extent.map((point) => point.y)) - FRAME_MARGIN
        const bottom = Math.max(...extent.map((point) => point.y)) + FRAME_MARGIN
        this.frame = {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top + CONTROLS_ROOM
        }
    }

    // A point on the board's plane, on screen.
    project(point: Point): Point {
        return { x: point.x, y: point.y * this.tilt }
    }

    // The centre of a space on the board's surface.
    center(coords: AxialCoordinates): Point {
        return this.project(flatCenter(coords))
    }

    // How far up the screen a height above the board shows.
    height(height: number): number {
        return height * this.rise
    }

    // A label beside an outer space, toward a neighbour it does not have, a gap beyond the
    // board's edge on screen. Labels on the same side all reach as far as the farthest of them,
    // so they stay in line.
    private labelBeside(coords: AxialCoordinates, toward: AxialCoordinates): Point {
        const step = { q: toward.q - coords.q, r: toward.r - coords.r }
        const from = flatCenter(coords)
        const to = flatCenter(toward)
        const length = Math.hypot(to.x - from.x, to.y - from.y)
        const along = { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
        const reach = Math.max(
            ...SPACES.filter((space) => !isSpace(addAxial(space, step))).map((space) =>
                edgeReach(this.flatCorners, this.edge, flatCenter(space), along)
            )
        )
        const edge = this.project({ x: from.x + along.x * reach, y: from.y + along.y * reach })
        const start = this.project(from)
        const screenLength = Math.hypot(edge.x - start.x, edge.y - start.y)
        return {
            x: edge.x + ((edge.x - start.x) / screenLength) * LABEL_GAP,
            y: edge.y + ((edge.y - start.y) / screenLength) * LABEL_GAP
        }
    }

    get viewBox(): string {
        const { x, y, width, height } = this.frame
        return `${x} ${y} ${width} ${height}`
    }
}

// The house angle, shared with the other GIPF project titles. The sand reaches past any stack on
// an outer space; the graph board ends where those stacks do.
export const VIEW = new BoardView(TILT, SAND_MARGIN)
export const GRAPH_VIEW = new BoardView(TILT, PIECE_RADIUS)

// How far from a point on the board, along a direction on the board's plane, an edge `margin` out
// is: where the point's distance from the corner spaces' hull reaches the margin.
function edgeReach(corners: readonly Point[], margin: number, from: Point, along: Point): number {
    let low = 0
    let high = margin * 4
    for (let step = 0; step < 40; step++) {
        const middle = (low + high) / 2
        const point = { x: from.x + along.x * middle, y: from.y + along.y * middle }
        if (distanceOutside(corners, point) < margin) low = middle
        else high = middle
    }
    return low
}

// How far a point lies outside a convex outline, listed clockwise on screen; 0 inside it.
function distanceOutside(points: readonly Point[], point: Point): number {
    let outside = false
    let nearest = Infinity
    points.forEach((start, index) => {
        const end = points[(index + 1) % points.length]
        const edge = { x: end.x - start.x, y: end.y - start.y }
        const offset = { x: point.x - start.x, y: point.y - start.y }
        if (edge.x * offset.y - edge.y * offset.x < 0) outside = true
        const length = edge.x ** 2 + edge.y ** 2
        const t = Math.max(0, Math.min(1, (edge.x * offset.x + edge.y * offset.y) / length))
        nearest = Math.min(nearest, Math.hypot(offset.x - edge.x * t, offset.y - edge.y * t))
    })
    return outside ? nearest : 0
}

// A convex outline on the board's plane, listed clockwise on screen, pushed out by `margin` with
// rounded corners, then seen at `tilt`: the corners' arcs become elliptical.
export function roundedOutline(points: readonly Point[], margin: number, tilt = 1): string {
    const normals = points.map((point, index) => {
        const next = points[(index + 1) % points.length]
        const length = Math.hypot(next.x - point.x, next.y - point.y)
        return { x: (next.y - point.y) / length, y: -(next.x - point.x) / length }
    })
    const offset = (point: Point, normal: Point) =>
        `${point.x + normal.x * margin} ${(point.y + normal.y * margin) * tilt}`
    return (
        points
            .map((point, index) => {
                const before = normals[(index + points.length - 1) % points.length]
                const after = normals[index]
                const next = points[(index + 1) % points.length]
                const start = index === 0 ? `M ${offset(point, before)} ` : ''
                return `${start}A ${margin} ${margin * tilt} 0 0 1 ${offset(point, after)} L ${offset(next, after)}`
            })
            .join(' ') + ' Z'
    )
}
