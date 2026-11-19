import type { Point } from '@tabletop/common'
import {
    BoardShape,
    gridOf,
    hexCellName,
    hexCellOf,
    hexSizeOf,
    Side,
    TOP_CORNER
} from '@tabletop/game-of-y'
import { POINT_PLAN, SHORTEST_LINE } from './pointPlan.js'

// The board seen from the near side of the table: the plan's depth shortened by TILT, heights
// shown at RISE. Seen flat, from straight above, the tilt is 1 and heights do not show.
export const TILT = 0.75
export const FLAT = 1

export function riseOf(tilt: number): number {
    return Math.sqrt(1 - tilt ** 2)
}

// Stones as large as the closest pair of points allows, a hair apart.
export const STONE_RADIUS = Math.floor(SHORTEST_LINE / 2 - 0.5)
// A go stone's thickness through its middle, both faces domed alike: Kuroki Goishiten's size 44
// clamshell stones, 12.6 mm thick and 21.9 mm across.
export const STONE_THICKNESS = STONE_RADIUS * 1.15

// A hex board's cells, centre to centre: a stone sits in its hexagon with a little room round it.
export const HEX_SPACING = 52
// A hex board's wood reaches as far past its outer cells on every side, the corners well rounded.
const HEX_MARGIN = 62
const HEX_CORNER_ROUNDING = 70
// Between a hex board's label and the hexagon beside it, more than beside a bare stone.
const HEX_LABEL_GAP = 6

// The wood reaches past the outer lines, furthest at the corners, which are rounded, with room
// on it for the coordinates beside the stones on the outer points.
const SIDE_MARGIN = 64
// The bottom side's letters are short and stand clear of no dome, so it reaches out less.
const BOTTOM_MARGIN = 52
const CORNER_MARGIN = 58
// The top corner reaches further, giving the labels on the upper sides room above their stones.
const TOP_CORNER_MARGIN = 76
const CORNER_ROUNDING = 34
// A solid slab, its edge showing on the near side.
export const BOARD_THICKNESS = 30
export const LABEL_SIZE = 17
// Between a label and a stone on the point it names.
const LABEL_GAP = 1.5
// How much a label's distance from its point may change from one label to the next along a side.
const LABEL_TAPER = 2
// How much of a stone's dome a label above it keeps clear of.
const DOME_CLEARANCE = 0.55

export function labelHalfWidth(text: string): number {
    return text.length * LABEL_SIZE * 0.31
}
// Room round everything drawn, for the zoom bar and the toggles.
const FRAME_MARGIN = 6

// Each side runs between two corners, through its middle point.
const SIDES: readonly { side: Side; from: string; middle: string; to: string }[] = [
    { side: Side.Left, from: TOP_CORNER, middle: 'A5', to: 'A1' },
    { side: Side.Bottom, from: 'A1', middle: 'E1', to: 'I1' },
    { side: Side.Right, from: 'I1', middle: 'M5', to: TOP_CORNER }
]

// A label on the rim: the point it stands beside, the way out to it on screen, and how much
// further than a stone on that point needs it stands, room a loose stone may lean into.
export type Label = {
    key: string
    text: string
    at: Point
    point: string
    going: Point
    spare: number
}
export type Box = { x: number; y: number; width: number; height: number }

// Where a point lies on its board, seen from above, in board units: Kadon's as laid out by
// scripts/layout-points.mjs, a hex board's cells in rows, the triangle centred on the origin.
export function planOf(shape: BoardShape, point: string): Point {
    const size = hexSizeOf(shape)
    if (size === undefined) return POINT_PLAN[point]
    const { row, column } = hexCellOf(point)
    const height = (HEX_SPACING * Math.sqrt(3)) / 2
    return {
        x: (column + row / 2 - (size - 1) / 2) * HEX_SPACING,
        y: ((size - 1) / 3 - row) * height
    }
}

export function center(shape: BoardShape, point: string, tilt: number): Point {
    const { x, y } = planOf(shape, point)
    return { x, y: y * tilt }
}

export function toScreen({ x, y }: Point, tilt: number, height = 0): Point {
    return { x, y: y * tilt - height * riseOf(tilt) }
}

const add = (a: Point, b: Point, scale = 1): Point => ({
    x: a.x + b.x * scale,
    y: a.y + b.y * scale
})
const unit = ({ x, y }: Point): Point => {
    const length = Math.hypot(x, y)
    return { x: x / length, y: y / length }
}

// The circle through three points, as its centre and radius.
function circleThrough(a: Point, b: Point, c: Point): { center: Point; radius: number } {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
    const square = (p: Point) => p.x * p.x + p.y * p.y
    const center = {
        x: (square(a) * (b.y - c.y) + square(b) * (c.y - a.y) + square(c) * (a.y - b.y)) / d,
        y: (square(a) * (c.x - b.x) + square(b) * (a.x - c.x) + square(c) * (b.x - a.x)) / d
    }
    return { center, radius: Math.hypot(a.x - center.x, a.y - center.y) }
}

// Points along the arc from `from` through `through` to `to`.
function arcPoints(from: Point, through: Point, to: Point, count: number): Point[] {
    const { center, radius } = circleThrough(from, through, to)
    const angle = (p: Point) => Math.atan2(p.y - center.y, p.x - center.x)
    const start = angle(from)
    const turn = (p: Point) => {
        let sweep = angle(p) - start
        while (sweep <= -Math.PI) sweep += 2 * Math.PI
        while (sweep > Math.PI) sweep -= 2 * Math.PI
        return sweep
    }
    const sweep = turn(to)
    return Array.from({ length: count + 1 }, (_, index) => {
        const at = start + (sweep * index) / count
        return { x: center.x + radius * Math.cos(at), y: center.y + radius * Math.sin(at) }
    })
}

// Kadon's outline in plan: each side an arc a margin outside its outer line, the corners further
// out and rounded.
function kadonOutline(): Point[] {
    const plan = (point: string) => POINT_PLAN[point]
    const outward = (point: string) => unit(plan(point))
    const arcs = SIDES.map(({ from, middle, to }) =>
        arcPoints(
            add(plan(from), outward(from), cornerMargin(from)),
            add(plan(middle), outward(middle), middle === 'E1' ? BOTTOM_MARGIN : SIDE_MARGIN),
            add(plan(to), outward(to), cornerMargin(to)),
            48
        )
    )
    return roundedCorners(arcs, CORNER_ROUNDING)
}

// A hex board's outline in plan: straight sides a margin outside its outer cells.
function hexOutline(shape: BoardShape): Point[] {
    const size = hexSizeOf(shape) ?? 0
    const last = size - 1
    const corners = [
        { row: last, column: 0 },
        { row: 0, column: 0 },
        { row: 0, column: last }
    ].map(({ row, column }) => {
        const at = planOf(shape, hexCellName({ row, column }))
        // A corner of a triangle moves out twice as far as its sides.
        return add(at, unit(at), HEX_MARGIN * 2)
    })
    const sides = corners.map((from, index) => {
        const to = corners[(index + 1) % corners.length]
        return Array.from({ length: 49 }, (_, step) => ({
            x: from.x + ((to.x - from.x) * step) / 48,
            y: from.y + ((to.y - from.y) * step) / 48
        }))
    })
    return roundedCorners(sides, HEX_CORNER_ROUNDING)
}

// Sides meeting at corners, each corner cut back by `rounding` along both sides and curved.
function roundedCorners(arcs: Point[][], rounding: number): Point[] {
    const trimmed = arcs.map((arc) => {
        const length = (points: Point[]) =>
            points
                .slice(1)
                .reduce(
                    (sum, p, index) =>
                        sum + Math.hypot(p.x - points[index].x, p.y - points[index].y),
                    0
                )
        const step = length(arc) / (arc.length - 1)
        const cut = Math.round(rounding / step)
        return arc.slice(cut, arc.length - cut)
    })
    return trimmed.flatMap((arc, index) => {
        const next = trimmed[(index + 1) % trimmed.length]
        const corner = arcs[index].at(-1)
        if (corner === undefined) throw Error('An arc has points')
        const end = arc.at(-1)
        if (end === undefined) throw Error('A trimmed arc has points')
        const rounding = Array.from({ length: 12 }, (_, step) => {
            const t = (step + 1) / 13
            return {
                x: (1 - t) ** 2 * end.x + 2 * (1 - t) * t * corner.x + t * t * next[0].x,
                y: (1 - t) ** 2 * end.y + 2 * (1 - t) * t * corner.y + t * t * next[0].y
            }
        })
        return [...arc, ...rounding]
    })
}

function cornerMargin(corner: string): number {
    return corner === TOP_CORNER ? TOP_CORNER_MARGIN : CORNER_MARGIN
}

function pathOf(points: readonly Point[]): string {
    return `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`
}

// How far out from its point a label must stand, going `going` on screen: clear of the footprint
// of a stone on the point (and of its cell, on a hex board), and above a stone most of its dome.
function labelRoom(text: string, going: Point, tilt: number, hex = false): number {
    const stone = Math.hypot(STONE_RADIUS * going.x, STONE_RADIUS * tilt * going.y)
    const cell = hex
        ? Math.max(
              ...Array.from({ length: 6 }, (_, step) => {
                  const angle = ((step * 60 - 90) * Math.PI) / 180
                  const corner = HEX_SPACING / Math.sqrt(3)
                  return corner * (Math.cos(angle) * going.x + Math.sin(angle) * tilt * going.y)
              })
          )
        : 0
    // Labels beside hexagons stand a little further off, clear of the lines round the cell.
    const footprint = hex ? cell + HEX_LABEL_GAP : stone
    const dome = going.y < 0 ? -going.y * STONE_THICKNESS * riseOf(tilt) * DOME_CLEARANCE : 0
    return footprint + dome + LABEL_GAP + labelExtent(text, going)
}

// Each label on the rim beside the point it names, square to that side as the board shows it, as
// far out as it needs, with the distance changing only a little from one label to the next, so a
// side's labels still run alongside it. A hex board's labels instead stand on the line each names,
// `along` it outward (seen from above), and keep clear of the cells when they are drawn.
function labelsAlong(
    shape: BoardShape,
    side: Side,
    named: (point: string) => string,
    tilt: number,
    along?: Point,
    clearCells = false
): Label[] {
    const grid = gridOf(shape)
    const points = grid.points.filter((point) => grid.sidesOf(point).includes(side))
    const placed = points.map((point) => ({
        point,
        text: named(point),
        going: along
            ? unit({ x: along.x, y: along.y * tilt })
            : outwardOnScreen(shape, points, point, tilt)
    }))
    const needed = placed.map(({ text, going }) => labelRoom(text, going, tilt, clearCells))
    const reach = needed.map((_, index) =>
        Math.max(...needed.map((need, other) => need - LABEL_TAPER * Math.abs(index - other)))
    )
    return placed.map(({ point, text, going }, index) => ({
        key: `${side}-${point}`,
        text,
        at: add(center(shape, point, tilt), going, reach[index]),
        point,
        going,
        spare: reach[index] - needed[index]
    }))
}

// How far a label's box reaches from its middle toward its point.
function labelExtent(text: string, going: Point): number {
    return Math.abs(going.x) * labelHalfWidth(text) + Math.abs(going.y) * LABEL_SIZE * 0.36
}

// Kadon's board names its points along every side, as BoardSpace does: the bottom side by letter,
// the other two by full name, the top corner once, above it.
function kadonLabels(tilt: number): Label[] {
    const shape = BoardShape.Kadon
    const rowNamed = (point: string) => point
    const up = { x: 0, y: -1 }
    return [
        ...labelsAlong(shape, Side.Bottom, (point) => point[0], tilt),
        ...labelsAlong(shape, Side.Left, rowNamed, tilt).filter(({ text }) => text !== TOP_CORNER),
        ...labelsAlong(shape, Side.Right, rowNamed, tilt).filter(({ text }) => text !== TOP_CORNER),
        {
            key: 'top',
            text: TOP_CORNER,
            at: add(center(shape, TOP_CORNER, tilt), up, labelRoom(TOP_CORNER, up, tilt)),
            point: TOP_CORNER,
            going: up,
            spare: 0
        }
    ]
}

// A hex board names its lines of cells as a Hex board does, each label standing on the line it
// names, beyond the side the line meets: a letter below the bottom side, on the line rising to the
// right, and a number beyond the left side, on the line rising to the left.
function hexLabels(shape: BoardShape, tilt: number, clearCells: boolean): Label[] {
    const slope = Math.sqrt(3) / 2
    const number = (point: string) => String(hexCellOf(point).row + 1)
    return [
        ...labelsAlong(
            shape,
            Side.Bottom,
            (point) => point[0],
            tilt,
            { x: -0.5, y: slope },
            clearCells
        ),
        ...labelsAlong(shape, Side.Left, number, tilt, { x: -0.5, y: -slope }, clearCells)
    ]
}

// Out from the board, square to the side through `point` as it shows on screen.
function outwardOnScreen(
    shape: BoardShape,
    side: readonly string[],
    point: string,
    tilt: number
): Point {
    const index = side.indexOf(point)
    const before = center(shape, side[Math.max(0, index - 1)], tilt)
    const after = center(shape, side[Math.min(side.length - 1, index + 1)], tilt)
    const tangent = unit({ x: after.x - before.x, y: after.y - before.y })
    const normal = { x: tangent.y, y: -tangent.x }
    // Kadon's middle point; a hex board is centred on the origin.
    const middle = shape === BoardShape.Kadon ? center(shape, 'G5', tilt) : { x: 0, y: 0 }
    const own = center(shape, point, tilt)
    const away = normal.x * (own.x - middle.x) + normal.y * (own.y - middle.y)
    return away > 0 ? normal : { x: -normal.x, y: -normal.y }
}

function boxOf(points: readonly Point[]): Box {
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

export class BoardView {
    readonly rise: number
    readonly points: readonly string[]
    readonly outline: string
    // The top and its edge together: the far half of the top's outline and the near half lowered
    // by the board's thickness.
    readonly slab: string
    // What the edge's grain covers: from the top's widest points down to the slab's lowest.
    readonly edgeBox: Box
    readonly labels: Label[]
    // Labels clear of the hexagons, on a hex board drawn as hexagons.
    readonly cellLabels: Label[]
    readonly frame: Box
    readonly woodBox: Box
    // The lines joining neighbouring points, as one path.
    readonly lines: string
    // A hex board's cells drawn as hexagons, as one path.
    readonly cells: string | undefined

    constructor(
        readonly shape: BoardShape,
        readonly tilt: number
    ) {
        this.rise = riseOf(tilt)
        this.points = gridOf(shape).points
        const hex = hexSizeOf(shape) !== undefined
        const plain = hex ? hexOutline(shape) : kadonOutline()
        const screen = plain.map((p) => toScreen(p, tilt))
        this.outline = pathOf(screen)
        const drop = BOARD_THICKNESS * this.rise
        const slab = slabOutline(screen, drop)
        this.slab = pathOf(slab)
        const sides = [
            screen.reduce((a, b) => (b.x < a.x ? b : a)),
            screen.reduce((a, b) => (b.x > a.x ? b : a))
        ]
        const slabBox = boxOf(slab)
        const edgeTop = Math.min(...sides.map((p) => p.y))
        this.edgeBox = {
            x: slabBox.x,
            y: edgeTop,
            width: slabBox.width,
            height: slabBox.y + slabBox.height - edgeTop
        }
        this.labels = hex ? hexLabels(shape, tilt, false) : kadonLabels(tilt)
        this.cellLabels = hex ? hexLabels(shape, tilt, true) : this.labels
        this.lines = linesOf(shape, tilt)
        this.cells = hex ? hexCells(shape, tilt) : undefined
        this.woodBox = boxOf(screen)
        const all = boxOf([...screen, ...slab])
        this.frame = {
            x: all.x - FRAME_MARGIN,
            y: all.y - FRAME_MARGIN,
            width: all.width + FRAME_MARGIN * 2,
            height: all.height + FRAME_MARGIN * 2
        }
    }

    get viewBox(): string {
        const { x, y, width, height } = this.frame
        return `${x} ${y} ${width} ${height}`
    }

    get flat(): boolean {
        return this.tilt === FLAT
    }

    center(point: string): Point {
        return center(this.shape, point, this.tilt)
    }
}

const VIEWS = new Map<string, BoardView>()

// Each board seen from the near side of the table, or flat; made once, when first shown.
export function boardView(shape: BoardShape, flat: boolean): BoardView {
    const key = `${shape}-${flat}`
    let view = VIEWS.get(key)
    if (view === undefined) {
        view = new BoardView(shape, flat ? FLAT : TILT)
        VIEWS.set(key, view)
    }
    return view
}

// A convex outline swept straight down by `drop`: the far chain between its leftmost and
// rightmost points stays, the near chain moves down.
function slabOutline(outline: readonly Point[], drop: number): Point[] {
    const left = outline.reduce((best, p, index) => (p.x < outline[best].x ? index : best), 0)
    const right = outline.reduce((best, p, index) => (p.x > outline[best].x ? index : best), 0)
    const walk = (from: number, to: number) => {
        const points: Point[] = []
        for (let index = from; ; index = (index + 1) % outline.length) {
            points.push(outline[index])
            if (index === to) return points
        }
    }
    const first = walk(left, right)
    const second = walk(right, left)
    const meanY = (points: Point[]) => points.reduce((sum, p) => sum + p.y, 0) / points.length
    const [far, near] = meanY(first) < meanY(second) ? [first, second] : [second, first]
    return [...far, ...near.map((p) => ({ x: p.x, y: p.y + drop }))]
}

function linesOf(shape: BoardShape, tilt: number): string {
    const grid = gridOf(shape)
    const order = new Map(grid.points.map((point, index) => [point, index]))
    return grid.points
        .flatMap((point) =>
            grid
                .neighborsOf(point)
                .filter((other) => (order.get(other) ?? 0) > (order.get(point) ?? 0))
                .map((other) => {
                    const a = center(shape, point, tilt)
                    const b = center(shape, other, tilt)
                    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
                })
        )
        .join(' ')
}

// Every cell's hexagon, pointed at the top and bottom, each edge drawn once.
function hexCells(shape: BoardShape, tilt: number): string {
    const corner = HEX_SPACING / Math.sqrt(3)
    const edges = new Map<string, string>()
    for (const point of gridOf(shape).points) {
        const { x, y } = planOf(shape, point)
        const around = Array.from({ length: 6 }, (_, step) => {
            const angle = ((step * 60 - 90) * Math.PI) / 180
            return toScreen(
                { x: x + corner * Math.cos(angle), y: y + corner * Math.sin(angle) },
                tilt
            )
        })
        around.forEach((from, step) => {
            const to = around[(step + 1) % 6]
            const ends = [from, to].map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
            const key = ends.toSorted().join('|')
            if (!edges.has(key)) edges.set(key, `M ${ends[0]} L ${ends[1]}`)
        })
    }
    return [...edges.values()].join(' ')
}
