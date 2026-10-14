import type { Point } from '@tabletop/common'
import { UnitType } from '@tabletop/napoleons-triumph'
import { onBattlefield } from '$lib/map/battlefield.js'
import {
    APPROACH_GEOMETRY,
    PRINTED_MARKS,
    type PrintedMark,
    type PrintedMarks
} from '$lib/map/boardGeometry.js'
import { BAR_HALF_THICKNESS } from './pieceLayout.js'

// The marks keep the proportions they are printed in on the board.
export const MARK_WIDTH = 19
export const MARK_HEIGHT = 10
const MARK_GAP = 4
const TAG_PADDING = 3.5
const BAR_CLEARANCE = 1
// The bars of the map file and of the rules data are the same bars, measured to a tenth.
const SAME_BAR = 1

export const TAG_HEIGHT = MARK_HEIGHT + TAG_PADDING * 2

export const MARK_PAPER = '#f1ecdc'
export const MARK_INK = '#2b2620'

export const PENALISED_UNIT_TYPE: Partial<Record<PrintedMark, UnitType>> = {
    I: UnitType.Infantry,
    C: UnitType.Cavalry,
    A: UnitType.Artillery
}

export interface PlacedMark {
    mark: PrintedMark
    left: number
}

export interface SymbolTag {
    key: string
    angle: number
    width: number
    marks: PlacedMark[]
    besideBar: Point
    awayFromBar: Point
}

export function sideKey(side: PrintedMarks): string {
    return `${side.centre.x}:${side.centre.y}`
}

/** The marks printed on an approach's own side of its bar. */
export function printedSideOf(approach: number): PrintedMarks | undefined {
    const { centre, inward } = APPROACH_GEOMETRY[approach]
    return PRINTED_MARKS.find(
        ({ bar, centre: marks }) =>
            Math.hypot(bar.x - centre.x, bar.y - centre.y) < SAME_BAR &&
            (marks.x - bar.x) * inward.x + (marks.y - bar.y) * inward.y > 0
    )
}

function tagOf(side: PrintedMarks): SymbolTag {
    const radians = (side.angle * Math.PI) / 180
    const along = { x: Math.cos(radians), y: Math.sin(radians) }
    const offset = { x: side.centre.x - side.bar.x, y: side.centre.y - side.bar.y }
    const reach = offset.x * along.x + offset.y * along.y
    const out = { x: offset.x - along.x * reach, y: offset.y - along.y * reach }
    const distance = Math.hypot(out.x, out.y)
    const width =
        side.marks.length * MARK_WIDTH + (side.marks.length - 1) * MARK_GAP + TAG_PADDING * 2
    return {
        key: sideKey(side),
        angle: side.angle,
        width,
        marks: side.marks.map((mark, index) => ({
            mark,
            left: -width / 2 + TAG_PADDING + index * (MARK_WIDTH + MARK_GAP)
        })),
        besideBar: { x: side.bar.x + along.x * reach, y: side.bar.y + along.y * reach },
        awayFromBar: { x: out.x / distance, y: out.y / distance }
    }
}

export const SYMBOL_TAGS: SymbolTag[] = PRINTED_MARKS.filter((side) =>
    onBattlefield(side.centre)
).map(tagOf)

export function approachSymbolScale(zoom: number): number {
    return Math.min(2, Math.max(1, 0.5 / zoom))
}

export function tagCentre(tag: SymbolTag, scale: number): Point {
    const clear = BAR_HALF_THICKNESS + BAR_CLEARANCE + (TAG_HEIGHT / 2) * scale
    return {
        x: tag.besideBar.x + tag.awayFromBar.x * clear,
        y: tag.besideBar.y + tag.awayFromBar.y * clear
    }
}
