import type { Point } from '@tabletop/common'
import { PieceKind } from '@tabletop/punct'
import { PIECE_HALF_WIDTH, PIECE_THICKNESS, PUNCT_RADIUS, type BoardView } from './geometry.js'
import { dotPlan, outlinePlan, pointInPolygon, round } from './pieceShape.js'

// The flecks in a piece's plastic, seeded by the piece's id so they stay its own as it moves
// and turns: on its top, round its PÜNCT's smooth insert, and on its side.
const TOP_DENSITY = 1 / 42
const SIDE_DENSITY = 1 / 30

type Speck = { x: number; y: number; r: number; stretch: number }
type SideSpeck = { edge: number; along: number; height: number; r: number }
export type Specks = { top: Speck[]; side: SideSpeck[] }

function random(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function speckRadius(next: () => number): number {
    const roll = next()
    return roll < 0.75 ? 0.7 + next() * 0.7 : 1.4 + next() * 1.3
}

const cache = new Map<string, Specks>()

// Laid out on the piece unturned; drawn turned with it.
export function specksOf(kind: PieceKind, seed: number): Specks {
    const key = `${kind}:${seed}`
    const cached = cache.get(key)
    if (cached) return cached
    const next = random(seed * 7919 + kind.length * 104729)
    const outline = outlinePlan(kind, 0, PIECE_HALF_WIDTH - 2)
    const punct = dotPlan(kind, 0)[0]
    const xs = outline.map((point) => point.x)
    const ys = outline.map((point) => point.y)
    const box = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
    }
    const top: Speck[] = []
    const tries = Math.round(box.width * box.height * TOP_DENSITY)
    for (let index = 0; index < tries; index++) {
        const point = { x: box.x + next() * box.width, y: box.y + next() * box.height }
        const r = speckRadius(next)
        const stretch = 0.6 + next() * 0.8
        if (!pointInPolygon(point, outline)) continue
        if (Math.hypot(point.x - punct.x, point.y - punct.y) < PUNCT_RADIUS + r) continue
        top.push({ ...point, r, stretch })
    }
    const full = outlinePlan(kind, 0)
    const side: SideSpeck[] = []
    full.forEach((a, edge) => {
        const b = full[(edge + 1) % full.length]
        const length = Math.hypot(b.x - a.x, b.y - a.y)
        const count = length * PIECE_THICKNESS * SIDE_DENSITY
        const whole = Math.floor(count) + (next() < count % 1 ? 1 : 0)
        for (let index = 0; index < whole; index++) {
            side.push({
                edge,
                along: next(),
                height: 0.12 + next() * 0.76,
                r: speckRadius(next) * 0.85
            })
        }
    })
    const specks = { top, side }
    cache.set(key, specks)
    return specks
}

function turn(point: Point, angle: number): Point {
    const radians = (angle * Math.PI) / 3
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos }
}

function ellipse(center: Point, rx: number, ry: number): string {
    const x = round(center.x - rx)
    return `M ${x} ${round(center.y)} a ${round(rx)} ${round(ry)} 0 1 0 ${round(2 * rx)} 0 a ${round(rx)} ${round(ry)} 0 1 0 ${round(-2 * rx)} 0`
}

// One path for the flecks on the top face, and one for those on the side panels that face
// the viewer, given each panel's outline index.
export function speckPaths(
    kind: PieceKind,
    seed: number,
    angle: number,
    view: BoardView,
    facing: ReadonlySet<number>
): { top: string; side: string } {
    const specks = specksOf(kind, seed)
    const top = specks.top
        .map((speck) =>
            ellipse(
                view.project(turn(speck, angle), PIECE_THICKNESS),
                speck.r * speck.stretch,
                (speck.r / speck.stretch) * view.tilt
            )
        )
        .join(' ')
    const outline = outlinePlan(kind, angle)
    const side = specks.side
        .filter((speck) => facing.has(speck.edge))
        .map((speck) => {
            const a = outline[speck.edge]
            const b = outline[(speck.edge + 1) % outline.length]
            const point = { x: a.x + (b.x - a.x) * speck.along, y: a.y + (b.y - a.y) * speck.along }
            return ellipse(view.project(point, PIECE_THICKNESS * speck.height), speck.r, speck.r)
        })
        .join(' ')
    return { top, side }
}
