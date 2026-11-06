import {
    addAxial,
    flatHexCoordsToCenterPoint,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { BOARD_RADIUS, isSpace, SPACES } from '@tabletop/tzaar'
import { boardLabels, type ColumnEnd } from './coordinates.js'
import {
    PIECE_MODEL,
    ROTATED_PIECE_MODEL,
    type PieceModel,
    PIECE_RADIUS,
    SPACING_UNIT,
    stackBounds,
    TILT
} from './pieceGeometry.js'

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
// Stacks left whole: the frame keeps room above the far row for one this tall, and grows over
// any taller one (`raiseFor`). None beyond the shrunk stacks' yet: TZAAR's board is fitted by its
// height on most screens, so the room shrinks it for every game.
export const WHOLE_FRAMED_HEIGHT = 0
// Room below the bottom labels for the zoom controls, which sit in the bottom-left corner.
const CONTROLS_ROOM = SPACING * 0.4

// One direction per line orientation, for drawing the grid.
const AXES: readonly AxialCoordinates[] = [
    { q: 0, r: 1 },
    { q: 1, r: 0 },
    { q: 1, r: -1 }
]

export type Line = { from: Point; to: Point }

export type Frame = { x: number; y: number; width: number; height: number }

// A stack on the board, as tall as it stands or is about to.
export type FramedStack = { coords: AxialCoordinates; height: number }

// A space's centre on the board's own plane, as if seen straight down.
export function flatCenter(coords: AxialCoordinates): Point {
    return flatHexCoordsToCenterPoint(coords, HEX_DIMENSIONS)
}

// Where everything on the board is drawn, in board units. The board is seen from the near side
// of the table: depth shrinks to `tilt` of its length, and heights show at `rise` of theirs. An
// unlabelled view's frame leaves no room for the labels. A rotated view turns the board a
// quarter turn clockwise, so its flat sides face the players and the columns run across, A at
// the top. A turned view sees the board from the far side, half a turn round, so what tall stacks
// hide comes in front. A view that does not shrink stacks stands every stack whole, for players
// who would rather turn the board to see past a tall one.
export class BoardView {
    readonly radius = PIECE_RADIUS
    readonly rise: number
    // The play area: the hexagon through the outer spaces, less the one round the centre.
    readonly playArea: string
    readonly lines: Line[]
    readonly labels: ColumnEnd[]
    readonly frame: Frame
    readonly model: PieceModel
    // The tallest stack the frame holds whole in the far row.
    readonly framedHeight: number
    // How many quarter turns clockwise the board is seen round, for what lies on the pieces.
    readonly quarterTurns: number

    constructor(
        readonly tilt: number,
        labelled = true,
        readonly rotated = false,
        readonly turned = false,
        readonly shrinks = true
    ) {
        this.rise = Math.sqrt(1 - tilt ** 2)
        this.quarterTurns = (rotated ? 1 : 0) + (turned ? 2 : 0)
        const shrunk = rotated ? ROTATED_PIECE_MODEL : PIECE_MODEL
        this.model = shrinks ? shrunk : { ...shrunk, cap: Number.POSITIVE_INFINITY }
        this.framedHeight = shrinks ? shrunk.cap : Math.max(shrunk.cap, WHOLE_FRAMED_HEIGHT)
        const outline = (distance: number) =>
            cornersAt(distance)
                .map((corner) => this.center(corner))
                .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
                .join(' ') + ' Z'
        this.playArea = `${outline(BOARD_RADIUS)} ${outline(1)}`
        this.lines = this.gridLines()

        this.labels = boardLabels(SPACES)

        const tallest = stackBounds(this.framedHeight, this.radius, this.model)
        const ys = SPACES.map((coords) => this.center(coords).y)
        const xs = SPACES.map((coords) => this.center(coords).x)
        const labelsAt = labelled ? this.labels.map((label) => this.labelAt(label)) : []
        const top = Math.min(
            Math.min(...ys) + tallest.top,
            ...labelsAt.map((at) => at.y - LABEL_HALF.y)
        )
        const bottom = Math.max(
            Math.max(...ys) + tallest.bottom,
            ...labelsAt.map((at) => at.y + LABEL_HALF.y)
        )
        const left =
            Math.min(Math.min(...xs) - this.radius, ...labelsAt.map((at) => at.x - LABEL_HALF.x)) -
            FRAME_MARGIN
        const right =
            Math.max(Math.max(...xs) + this.radius, ...labelsAt.map((at) => at.x + LABEL_HALF.x)) +
            FRAME_MARGIN
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
    // near edge, or on a rotated board beside it, the column's start on the left; outside the
    // board either way, so on a turned board a column's top is at the bottom or on the left. A
    // taller stack on a top space covers its label.
    labelAt(label: ColumnEnd): Point {
        const center = this.center(label.coords)
        const above = label.above !== this.turned
        if (this.rotated) {
            const reach = this.radius + LABEL_GAP + LABEL_HALF.x
            return { x: center.x + (above ? reach : -reach), y: center.y }
        }
        const single = stackBounds(1, this.radius)
        const offset = above
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
        const flat = flatCenter(coords)
        const turned = this.rotated ? { x: -flat.y, y: flat.x } : flat
        return this.project(this.turned ? { x: -turned.x, y: -turned.y } : turned)
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

    // How far the frame must rise over stacks left whole that would stand out of it, and over
    // `tops`, the highest points of stacks in flight. Shrunk stacks never do. The board then
    // shrinks to keep them in view.
    raiseFor(stacks: Iterable<FramedStack>, tops: Iterable<number> = []): number {
        if (this.shrinks) return 0
        let top = this.frame.y
        for (const { coords, height } of stacks) {
            if (height <= this.framedHeight) continue
            const bounds = stackBounds(height, this.radius, this.model)
            top = Math.min(top, this.center(coords).y + bounds.top - FRAME_MARGIN)
        }
        for (const y of tops) top = Math.min(top, y - FRAME_MARGIN)
        return this.frame.y - top
    }

    // The frame raised by `raise`.
    raised(raise: number): Frame {
        return { ...this.frame, y: this.frame.y - raise, height: this.frame.height + raise }
    }
}

// The house angle, shared with the other GIPF project titles.
export const VIEW = new BoardView(TILT)

const VIEWS = new Map<string, BoardView>([['true,false,false,true', VIEW]])

export function viewOf(
    labelled: boolean,
    rotated: boolean,
    turned: boolean,
    shrink: boolean
): BoardView {
    const key = `${labelled},${rotated},${turned},${shrink}`
    let view = VIEWS.get(key)
    if (view === undefined) {
        view = new BoardView(TILT, labelled, rotated, turned, shrink)
        VIEWS.set(key, view)
    }
    return view
}
