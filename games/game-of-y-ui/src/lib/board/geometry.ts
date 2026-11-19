import type { Point } from '@tabletop/common'
import { POINTS, Side, sidesOf, TOP_CORNER } from '@tabletop/game-of-y'
import { POINT_PLAN, SHORTEST_LINE } from './pointPlan.js'

// The board seen from the near side of the table: the plan's depth shortened by TILT, heights
// shown at RISE.
export const TILT = 0.75
export const RISE = Math.sqrt(1 - TILT ** 2)

// Stones as large as the closest pair of points allows, a hair apart.
export const STONE_RADIUS = Math.floor(SHORTEST_LINE / 2 - 0.5)
// A go stone's thickness through its middle, both faces domed alike: Kuroki Goishiten's size 44
// clamshell stones, 12.6 mm thick and 21.9 mm across.
export const STONE_THICKNESS = STONE_RADIUS * 1.15

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

const CORNERS = [TOP_CORNER, 'A1', 'I1'] as const
// Each side runs between two corners, through its middle point.
const SIDES: readonly { side: Side; from: string; middle: string; to: string }[] = [
    { side: Side.Left, from: TOP_CORNER, middle: 'A5', to: 'A1' },
    { side: Side.Bottom, from: 'A1', middle: 'E1', to: 'I1' },
    { side: Side.Right, from: 'I1', middle: 'M5', to: TOP_CORNER }
]

export type Label = { key: string; text: string; at: Point }
export type Box = { x: number; y: number; width: number; height: number }

export function plan(point: string): Point {
    return POINT_PLAN[point]
}

export function center(point: string): Point {
    const { x, y } = plan(point)
    return { x, y: y * TILT }
}

export function toScreen({ x, y }: Point, height = 0): Point {
    return { x, y: y * TILT - height * RISE }
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

// The board's outline in plan: each side an arc a margin outside its outer line, the corners
// further out and rounded.
function outlinePlan(): Point[] {
    const outward = (point: string) => unit(plan(point))
    const sideNormal = (middle: string) => outward(middle)
    const arcs = SIDES.map(({ from, middle, to }) =>
        arcPoints(
            add(plan(from), outward(from), cornerMargin(from)),
            add(plan(middle), sideNormal(middle), middle === 'E1' ? BOTTOM_MARGIN : SIDE_MARGIN),
            add(plan(to), outward(to), cornerMargin(to)),
            48
        )
    )
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
        const cut = Math.round(CORNER_ROUNDING / step)
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

// Each label on the rim beside the point it names, square to that side as the board shows it:
// as far out as it needs to clear the footprint of a stone, and above a stone most of its dome,
// with the distance changing only a little from one label to the next, so a side's labels still
// run alongside it.
function labelsFor(): Label[] {
    const room = (text: string, going: Point) => {
        const footprint = Math.hypot(STONE_RADIUS * going.x, STONE_RADIUS * TILT * going.y)
        const dome = going.y < 0 ? -going.y * STONE_THICKNESS * RISE * DOME_CLEARANCE : 0
        const half =
            Math.abs(going.x) * labelHalfWidth(text) + Math.abs(going.y) * LABEL_SIZE * 0.36
        return footprint + dome + LABEL_GAP + half
    }
    const alongSide = (side: Side, named: (point: string) => string) => {
        const points = POINTS.filter((point) => sidesOf(point).includes(side))
        const placed = points.map((point) => ({
            point,
            text: named(point),
            going: outwardOnScreen(points, point)
        }))
        const needed = placed.map(({ text, going }) => room(text, going))
        const reach = needed.map((_, index) =>
            Math.max(...needed.map((need, other) => need - LABEL_TAPER * Math.abs(index - other)))
        )
        return placed.map(({ point, text, going }, index) => ({
            key: `${side}-${point}`,
            text,
            at: add(center(point), going, reach[index])
        }))
    }
    const rowNamed = (point: string) => point
    return [
        ...alongSide(Side.Bottom, (point) => point[0]),
        ...alongSide(Side.Left, rowNamed).filter(({ text }) => text !== TOP_CORNER),
        ...alongSide(Side.Right, rowNamed).filter(({ text }) => text !== TOP_CORNER),
        {
            key: 'top',
            text: TOP_CORNER,
            at: add(center(TOP_CORNER), { x: 0, y: -1 }, room(TOP_CORNER, { x: 0, y: -1 }))
        }
    ]
}

// Out from the board, square to the side through `point` as it shows on screen.
function outwardOnScreen(side: readonly string[], point: string): Point {
    const index = side.indexOf(point)
    const before = center(side[Math.max(0, index - 1)])
    const after = center(side[Math.min(side.length - 1, index + 1)])
    const tangent = unit({ x: after.x - before.x, y: after.y - before.y })
    const normal = { x: tangent.y, y: -tangent.x }
    const middle = center('G5')
    const own = center(point)
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
    readonly outline: string
    // The top and its edge together: the far half of the top's outline and the near half lowered
    // by the board's thickness.
    readonly slab: string
    // What the edge's grain covers: from the top's widest points down to the slab's lowest.
    readonly edgeBox: Box
    readonly labels: Label[]
    readonly frame: Box
    readonly woodBox: Box

    constructor() {
        const plain = outlinePlan()
        const screen = plain.map((p) => toScreen(p))
        this.outline = pathOf(screen)
        const drop = BOARD_THICKNESS * RISE
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
        this.labels = labelsFor()
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

    center(point: string): Point {
        return center(point)
    }
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

export function linesOf(neighbors: (point: string) => readonly string[]): [Point, Point][] {
    return POINTS.flatMap((point) =>
        neighbors(point)
            .filter((other) => POINTS.indexOf(other) > POINTS.indexOf(point))
            .map((other): [Point, Point] => [center(point), center(other)])
    )
}

export const VIEW = new BoardView()

export { CORNERS }
