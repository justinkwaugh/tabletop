import {
    addAxial,
    flatHexCoordsToCenterPoint,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { BOARD_RADIUS, isSpace, SPACES } from '@tabletop/tzaar'
import { boardLabels, type ColumnEnd } from './coordinates.js'
import { PIECE_MODEL, PIECE_RADIUS, SPACING_UNIT, stackBounds, TILT } from './pieceGeometry.js'

export const SPACING = SPACING_UNIT

const HEX_DIMENSIONS = { xRadius: SPACING / Math.sqrt(3), yRadius: SPACING / 2 }

export function coordsKey(coords: AxialCoordinates): string {
    return `${coords.q},${coords.r}`
}

// The corners of the board and of the centre it lacks, clockwise from the top.
function cornersAt(distance: number): AxialCoordinates[] {
    return [
        { q: 0, r: -distance },
        { q: distance, r: -distance },
        { q: distance, r: 0 },
        { q: 0, r: distance },
        { q: -distance, r: distance },
        { q: -distance, r: 0 }
    ]
}

// The lines run on past the outer spaces by this share of a step, as on the printed board.
const WHISKER = 0.25
// From a column's end stack to its label, on screen.
const LABEL_GAP = SPACING * 0.22
// Half a label's size, for the frame.
const LABEL_HALF = { x: 11, y: 8 }
// From the board, its pieces and the labels to the frame's edge.
const FRAME_MARGIN = SPACING * 0.15
// Room below the bottom labels for the zoom controls, which sit in the bottom-left corner.
const CONTROLS_ROOM = SPACING * 0.4

// One direction per line orientation, for drawing the grid.
const AXES: readonly AxialCoordinates[] = [
    { q: 0, r: 1 },
    { q: 1, r: 0 },
    { q: 1, r: -1 }
]

export type Line = { from: Point; to: Point }

// A space's centre on the board's own plane, as if seen straight down.
export function flatCenter(coords: AxialCoordinates): Point {
    return flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
}

// Where everything on the board is drawn, in board units. The board is seen from the near side
// of the table: depth shrinks to `tilt` of its length, and heights show at `rise` of theirs. An
// unlabelled view's frame leaves no room for the labels.
export class BoardView {
    readonly radius = PIECE_RADIUS
    readonly rise: number
    // The play area: the hexagon through the outer spaces, less the one round the centre.
    readonly playArea: string
    readonly lines: Line[]
    readonly labels: ColumnEnd[]
    readonly frame: { x: number; y: number; width: number; height: number }

    constructor(
        readonly tilt: number,
        labelled = true
    ) {
        this.rise = Math.sqrt(1 - tilt ** 2)
        const outline = (distance: number) =>
            cornersAt(distance)
                .map((corner) => this.center(corner))
                .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
                .join(' ') + ' Z'
        this.playArea = `${outline(BOARD_RADIUS)} ${outline(1)}`
        this.lines = this.gridLines()

        this.labels = boardLabels(SPACES)

        const tallest = stackBounds(PIECE_MODEL.cap, this.radius)
        const ys = SPACES.map((coords) => this.center(coords).y)
        const xs = SPACES.map((coords) => this.center(coords).x)
        const labelYs = this.labels.map((label) => this.labelAt(label).y)
        const top = Math.min(
            Math.min(...ys) + tallest.top,
            ...(labelled ? labelYs.map((y) => y - LABEL_HALF.y) : [])
        )
        const bottom = Math.max(
            Math.max(...ys) + tallest.bottom,
            ...(labelled ? labelYs.map((y) => y + LABEL_HALF.y) : [])
        )
        const left = Math.min(...xs) - this.radius - FRAME_MARGIN
        const right = Math.max(...xs) + this.radius + FRAME_MARGIN
        const frameTop = top - FRAME_MARGIN
        const frameBottom = bottom + FRAME_MARGIN
        this.frame = {
            x: left,
            y: frameTop,
            width: right - left,
            height: frameBottom - frameTop + CONTROLS_ROOM
        }
    }

    // A label a gap beyond the piece at its column's end: above a single piece's top, below its
    // near edge. A taller stack on a top space covers its label.
    labelAt(label: ColumnEnd): Point {
        const center = this.center(label.coords)
        const single = stackBounds(1, this.radius)
        const offset = label.above
            ? single.top - LABEL_GAP - LABEL_HALF.y
            : single.bottom + LABEL_GAP + LABEL_HALF.y
        return { x: center.x, y: center.y + offset }
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

    // Each run of neighbouring spaces along a direction, whiskered past the board's edge but not
    // into the centre, which no line crosses.
    private gridLines(): Line[] {
        const beyond = (coords: AxialCoordinates, step: AxialCoordinates) => {
            const next = addAxial(coords, step)
            const from = this.center(coords)
            if (next.q === 0 && next.r === 0) return from
            const to = this.center(next)
            return { x: from.x + (to.x - from.x) * WHISKER, y: from.y + (to.y - from.y) * WHISKER }
        }
        return AXES.flatMap((axis) => {
            const back = { q: -axis.q, r: -axis.r }
            return SPACES.filter((space) => !isSpace(addAxial(space, back))).flatMap((start) => {
                let end = start
                while (isSpace(addAxial(end, axis))) end = addAxial(end, axis)
                return start === end ? [] : [{ from: beyond(start, back), to: beyond(end, axis) }]
            })
        })
    }

    get viewBox(): string {
        const { x, y, width, height } = this.frame
        return `${x} ${y} ${width} ${height}`
    }
}

// The house angle, shared with the other GIPF project titles.
export const VIEW = new BoardView(TILT)
export const UNLABELLED_VIEW = new BoardView(TILT, false)
