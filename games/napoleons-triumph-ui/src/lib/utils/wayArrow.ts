import type { Point } from '@tabletop/common'
import { coveredBy, type BlockFootprint } from './blockShape.js'

export const ARROW_HEAD_LENGTH = 30
const SHORTEST_ARROW = 64
const CLEARANCE = 8
const SCAN_STEP = 3
const FARTHEST_CLEARING_TO_A_BEND = 0.7
const LONGEST_STACK = 400
const NEAREST_BEND = 40
const HEAD_SHARE = 0.55
const SHAFT_INSET = 4
const SAMPLE_STEP = 10

function span(from: Point, to: Point): number {
    return Math.hypot(to.x - from.x, to.y - from.y)
}

function towards(from: Point, to: Point, reach: number): Point {
    const length = span(from, to) || 1
    return {
        x: from.x + ((to.x - from.x) * reach) / length,
        y: from.y + ((to.y - from.y) * reach) / length
    }
}

function reachClearOf(
    blocks: readonly BlockFootprint[],
    from: Point,
    to: Point,
    farthest: number
): number {
    const covered = coveredBy(blocks, CLEARANCE)
    const reaches = Array.from(
        { length: Math.floor(farthest / SCAN_STEP) + 1 },
        (_, index) => index * SCAN_STEP
    )
    const last = reaches.findLast((reach) => covered(towards(from, to, reach)))
    return last === undefined ? 0 : Math.min(last + SCAN_STEP, farthest)
}

// Deliberate: where the blocks left and the blocks arrived at stand too close for an arrow between
// them, the arrow starts farther back, over the blocks left, rather than shrink to nothing.
export function arrowAlong(
    way: readonly Point[],
    left: readonly BlockFootprint[],
    arrived: readonly BlockFootprint[]
): Point[] {
    const first = way.at(0)
    const last = way.at(-1)
    if (!first || !last || way.length < 2) {
        return []
    }
    const next = way[1]
    const previous = way[way.length - 2]
    const toBend = (from: Point, bend: Point) => span(from, bend) * FARTHEST_CLEARING_TO_A_BEND
    const tail = towards(first, next, reachClearOf(left, first, next, toBend(first, next)))
    const tip = towards(
        last,
        previous,
        reachClearOf(arrived, last, previous, toBend(last, previous))
    )
    const bends = way
        .slice(1, -1)
        .filter((bend) => span(bend, tail) >= NEAREST_BEND && span(bend, tip) >= NEAREST_BEND)
    if (bends.length > 0) {
        return [tail, ...bends, tip]
    }
    const leaving = reachClearOf(left, first, last, LONGEST_STACK)
    const reaching = reachClearOf(arrived, last, first, LONGEST_STACK)
    const room = span(first, last) - leaving - reaching
    return [
        room >= SHORTEST_ARROW
            ? towards(first, last, leaving)
            : towards(last, first, reaching + SHORTEST_ARROW),
        towards(last, first, reaching)
    ]
}

export interface DrawnArrow {
    shaft: Point[]
    tip: Point
    angle: number
    scale: number
}

export function drawnArrow(line: readonly Point[]): DrawnArrow | undefined {
    const tip = line.at(-1)
    const previous = line.at(-2)
    if (!tip || !previous) {
        return undefined
    }
    const scale = Math.min(1, (span(previous, tip) * HEAD_SHARE) / ARROW_HEAD_LENGTH)
    const headBase = towards(tip, previous, Math.max(0, ARROW_HEAD_LENGTH * scale - SHAFT_INSET))
    return {
        shaft: [...line.slice(0, -1), headBase],
        tip,
        angle: (Math.atan2(tip.y - previous.y, tip.x - previous.x) * 180) / Math.PI,
        scale
    }
}

export function lineSamples(line: readonly Point[]): Point[] {
    return line.slice(1).flatMap((to, index) => {
        const from = line[index]
        const count = Math.max(1, Math.ceil(span(from, to) / SAMPLE_STEP))
        return Array.from({ length: count + 1 }, (_, step) =>
            towards(from, to, (span(from, to) * step) / count)
        )
    })
}
