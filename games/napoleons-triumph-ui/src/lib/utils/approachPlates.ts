import type { BoundingBox, Point } from '@tabletop/common'
import {
    APPROACH_GEOMETRY,
    type ApproachGeometry,
    type PrintedMark
} from '$lib/map/boardGeometry.js'
import { printedSideOf, sideKey } from './approachSymbols.js'
import { BLOCK_SYMBOL_HEIGHT, BLOCK_SYMBOL_WIDTH } from './faceLayout.js'
import { reachOfFiles, type HeldApproach } from './pieceLayout.js'

const GAP_FROM_FILES = 3
const PADDING = 3.5
const MARK_GAP = 3.5
const SAMPLE_STEP = 8

export const PLATE_MARK = { width: BLOCK_SYMBOL_WIDTH, height: BLOCK_SYMBOL_HEIGHT }

export interface PlateMark {
    mark: PrintedMark
    topLeft: Point
}

/** Laid out in the frame of its bar: x along the bar from its middle, y across it. */
export interface ApproachPlate {
    approach: number
    /** The printed side whose marks it carries. */
    side: string
    box: BoundingBox
    marks: PlateMark[]
}

interface BarFrame {
    along: Point
    across: Point
}

function frameOf(bar: ApproachGeometry): BarFrame {
    const radians = (bar.angle * Math.PI) / 180
    const along = { x: Math.cos(radians), y: Math.sin(radians) }
    return { along, across: { x: -along.y, y: along.x } }
}

/** Which way along its bar, 1 or -1, lies the end on the left of the pieces as they face across it. */
export function leftEndOf(bar: ApproachGeometry): number {
    const { along } = frameOf(bar)
    return -bar.inward.y * along.x + bar.inward.x * along.y > 0 ? 1 : -1
}

function plateOf(approach: number): ApproachPlate | undefined {
    const side = printedSideOf(approach)
    if (!side) {
        return undefined
    }
    const bar = APPROACH_GEOMETRY[approach]
    const { across } = frameOf(bar)
    const intoLocale = bar.inward.x * across.x + bar.inward.y * across.y > 0
    // Deliberate: the end on the left of the pieces as they face across the bar, so two armies
    // facing each other across one bar never take the same end.
    const towardsPositive = leftEndOf(bar) > 0
    const width = PLATE_MARK.width + PADDING * 2
    const rows = side.marks.length
    const height = rows * PLATE_MARK.height + (rows - 1) * MARK_GAP + PADDING * 2
    const near = reachOfFiles(bar) + GAP_FROM_FILES
    const x = towardsPositive ? near : -near - width
    return {
        approach,
        side: sideKey(side),
        box: { x, y: intoLocale ? 0 : -height, width, height },
        marks: side.marks.map((mark, row) => {
            const fromTheLine = PADDING + row * (PLATE_MARK.height + MARK_GAP)
            return {
                mark,
                topLeft: {
                    x: x + PADDING,
                    y: intoLocale ? fromTheLine : -fromTheLine - PLATE_MARK.height
                }
            }
        })
    }
}

/** One for each held approach that has marks: its pieces stand on the printed ones. */
export function approachPlates(held: readonly HeldApproach[]): ApproachPlate[] {
    return held.flatMap(({ approach }) => plateOf(approach) ?? [])
}

function stepsAcross(length: number): number[] {
    const count = Math.ceil(length / SAMPLE_STEP)
    return Array.from({ length: count + 1 }, (_, index) => (length * index) / count)
}

/** Points on the board that cover every plate, for whatever has to keep off them. */
export function plateSamples(plates: readonly ApproachPlate[]): Point[] {
    return plates.flatMap(({ approach, box }) => {
        const bar = APPROACH_GEOMETRY[approach]
        const { along, across } = frameOf(bar)
        return stepsAcross(box.width).flatMap((right) =>
            stepsAcross(box.height).map((down) => ({
                x: bar.centre.x + along.x * (box.x + right) + across.x * (box.y + down),
                y: bar.centre.y + along.y * (box.x + right) + across.y * (box.y + down)
            }))
        )
    })
}
