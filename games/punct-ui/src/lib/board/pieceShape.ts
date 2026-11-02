import type { Point } from '@tabletop/common'
import { dotsOf, PieceKind } from '@tabletop/punct'
import { DISH_RADIUS, PIECE_HALF_WIDTH, PIECE_THICKNESS, VIEW, type BoardView } from './geometry.js'

// A piece's plan, flat on the board round its PÜNCT at the origin: where its dots lie and its
// outline, the dots joined by bars as wide as the piece, rounded at every outer corner.

export type Tone = 'light' | 'dark'

const ORIGIN = { q: 0, r: 0 }
const CAP_STEPS = 18
const CORNER_STEPS = 8

// The dots of a piece turned through an angle (a rotation step is a sixth of a turn), PÜNCT
// first, flat.
export function dotPlan(kind: PieceKind, angle: number): Point[] {
    return dotsOf(kind, ORIGIN, 0).map((dot) => rotate(VIEW.plan(dot), angle))
}

function rotate(point: Point, angle: number): Point {
    const radians = (angle * Math.PI) / 3
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos }
}

// The spine the piece is built along: from one end dot to the other, through the corner of an
// angular piece; a triangle closes on itself.
function spine(kind: PieceKind, dots: Point[]): { points: Point[]; closed: boolean } {
    switch (kind) {
        case PieceKind.Triangle:
            return { points: dots, closed: true }
        case PieceKind.StraightEnd:
        case PieceKind.AngleLeft:
        case PieceKind.AngleRight:
            return { points: dots, closed: false }
        case PieceKind.StraightCentre:
        case PieceKind.AngleCorner:
            return { points: [dots[1], dots[0], dots[2]], closed: false }
    }
}

function arc(center: Point, radius: number, from: number, to: number, steps: number): Point[] {
    return Array.from({ length: steps + 1 }, (_, index) => {
        const angle = from + ((to - from) * index) / steps
        return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
    })
}

function heading(from: Point, to: Point): number {
    return Math.atan2(to.y - from.y, to.x - from.x)
}

function intersect(a: Point, da: Point, b: Point, db: Point): Point {
    const cross = da.x * db.y - da.y * db.x
    const t = ((b.x - a.x) * db.y - (b.y - a.y) * db.x) / cross
    return { x: a.x + da.x * t, y: a.y + da.y * t }
}

// One side of an open spine, offset by the half width: straight along each bar, an arc round
// the outside of a bend, the meeting point of the two edges inside it.
function side(points: Point[], width: number): Point[] {
    const out: Point[] = []
    for (let index = 0; index < points.length - 1; index++) {
        const a = points[index]
        const b = points[index + 1]
        const angle = heading(a, b)
        const normal = angle - Math.PI / 2
        const offset = { x: width * Math.cos(normal), y: width * Math.sin(normal) }
        if (index === 0) out.push({ x: a.x + offset.x, y: a.y + offset.y })
        const next = points[index + 2]
        if (next === undefined) {
            out.push({ x: b.x + offset.x, y: b.y + offset.y })
            continue
        }
        const nextAngle = heading(b, next)
        const turn = Math.atan2(Math.sin(nextAngle - angle), Math.cos(nextAngle - angle))
        if (Math.abs(turn) < 1e-6) continue
        if (turn < 0) {
            // Turning towards this side: the edges meet inside the bend.
            const nextNormal = nextAngle - Math.PI / 2
            out.push(
                intersect(
                    { x: a.x + offset.x, y: a.y + offset.y },
                    { x: Math.cos(angle), y: Math.sin(angle) },
                    {
                        x: b.x + width * Math.cos(nextNormal),
                        y: b.y + width * Math.sin(nextNormal)
                    },
                    { x: Math.cos(nextAngle), y: Math.sin(nextAngle) }
                )
            )
        } else {
            out.push(...arc(b, width, normal, normal + turn, CORNER_STEPS))
        }
    }
    return out
}

// The bars the piece is built along, flat round its PÜNCT turned through an angle: what it
// sweeps over as it turns or flies.
export function spineSegments(kind: PieceKind, angle: number): [Point, Point][] {
    const { points, closed } = spine(kind, dotPlan(kind, angle))
    const segments: [Point, Point][] = points
        .slice(0, -1)
        .map((point, index) => [point, points[index + 1]])
    if (closed) segments.push([points[points.length - 1], points[0]])
    return segments
}

// The outline, clockwise on screen (y down).
export function outlinePlan(kind: PieceKind, angle: number, width = PIECE_HALF_WIDTH): Point[] {
    const { points, closed } = spine(kind, dotPlan(kind, angle))
    if (closed) {
        const clockwise = signedArea(points) > 0 ? points : points.toReversed()
        return clockwise.flatMap((point, index) => {
            const previous = clockwise[(index + clockwise.length - 1) % clockwise.length]
            const next = clockwise[(index + 1) % clockwise.length]
            // The edges' normals point outward for this winding; round the corner between them.
            const inAngle = heading(previous, point) - Math.PI / 2
            const outAngle = heading(point, next) - Math.PI / 2
            const sweep = Math.atan2(Math.sin(outAngle - inAngle), Math.cos(outAngle - inAngle))
            return arc(point, width, inAngle, inAngle + sweep, CORNER_STEPS)
        })
    }
    const there = side(points, width)
    const back = side(points.toReversed(), width)
    const end = points[points.length - 1]
    const start = points[0]
    const endAngle = heading(points[points.length - 2], end) - Math.PI / 2
    const startAngle = heading(points[1], start) - Math.PI / 2
    const outline = [
        ...there,
        ...arc(end, width, endAngle, endAngle + Math.PI, CAP_STEPS).slice(1, -1),
        ...back,
        ...arc(start, width, startAngle, startAngle + Math.PI, CAP_STEPS).slice(1, -1)
    ]
    return signedArea(outline) > 0 ? outline : outline.toReversed()
}

// Positive for points running clockwise on screen.
export function signedArea(points: readonly Point[]): number {
    let area = 0
    for (let index = 0; index < points.length; index++) {
        const a = points[index]
        const b = points[(index + 1) % points.length]
        area += a.x * b.y - b.x * a.y
    }
    return area / 2
}

export function pathOf(points: readonly Point[]): string {
    return `M ${points.map((point) => `${round(point.x)} ${round(point.y)}`).join(' L ')} Z`
}

export function round(value: number): number {
    return Math.round(value * 100) / 100
}

// A straight, upright side with only slightly rounded edges at the base and the rim. Rounded as
// much as GIPF's discs (a quarter and a third of the thickness), the shading ran from light to
// dark down most of the side, which read as a sloping, trapezoidal side.
const BASE_ROUND = PIECE_THICKNESS * 0.1
const RIM_ROUND = PIECE_THICKNESS * 0.13
// The top face reaches a little over the rim's rounding, as GIPF's does.
const TOP_INSET = RIM_ROUND * 0.6
const SLICES = 16

// How far the outline draws in from the piece's full width at a height up its side, and which
// way the side faces there: -1 straight down, 0 out, 1 straight up.
export function profileAt(
    height: number,
    thickness = PIECE_THICKNESS
): { inset: number; facing: number } {
    if (height < BASE_ROUND) {
        const from = BASE_ROUND - height
        return {
            inset: BASE_ROUND - Math.sqrt(Math.max(0, BASE_ROUND ** 2 - from ** 2)),
            facing: -from / BASE_ROUND
        }
    }
    const rimStart = thickness - RIM_ROUND
    if (height > rimStart) {
        const into = height - rimStart
        return {
            inset: RIM_ROUND - Math.sqrt(Math.max(0, RIM_ROUND ** 2 - into ** 2)),
            facing: into / RIM_ROUND
        }
    }
    return { inset: 0, facing: 0 }
}

export function insetAt(height: number, thickness = PIECE_THICKNESS): number {
    return profileAt(height, thickness).inset
}

// How many shades a slice can take, from facing straight down to facing straight up.
export const SHADE_LEVELS = 9

// A slice of the side, drawn bottom first: each leaves only its front edge showing, up to the
// next. Its shade level says which way it faces, up or down.
export type SideSlice = { points: Point[]; shade: number }

export type PieceDrawing = {
    slices: SideSlice[]
    top: Point[]
    dots: Point[]
    // Just inside the top face's edge, for marks.
    topOutline: Point[]
}

export function drawPiece(
    kind: PieceKind,
    angle: number,
    view: BoardView = VIEW,
    thickness = PIECE_THICKNESS
): PieceDrawing {
    const slices = Array.from({ length: SLICES + 1 }, (_, index) => {
        const height = (thickness * index) / SLICES
        const { inset, facing } = profileAt(height, thickness)
        return {
            points: outlinePlan(kind, angle, PIECE_HALF_WIDTH - inset).map((point) =>
                view.project(point, height)
            ),
            shade: Math.round(((facing + 1) / 2) * (SHADE_LEVELS - 1))
        }
    })
    return {
        slices,
        top: outlinePlan(kind, angle, PIECE_HALF_WIDTH - TOP_INSET).map((point) =>
            view.project(point, thickness)
        ),
        dots: dotPlan(kind, angle).map((dot) => view.project(dot, thickness)),
        topOutline: outlinePlan(kind, angle, PIECE_HALF_WIDTH - TOP_INSET - 2).map((point) =>
            view.project(point, thickness)
        )
    }
}

export function dishOf(view: BoardView = VIEW): { rx: number; ry: number } {
    return { rx: DISH_RADIUS, ry: DISH_RADIUS * view.tilt }
}

export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i]
        const b = polygon[j]
        if (
            a.y > point.y !== b.y > point.y &&
            point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
        ) {
            inside = !inside
        }
    }
    return inside
}
