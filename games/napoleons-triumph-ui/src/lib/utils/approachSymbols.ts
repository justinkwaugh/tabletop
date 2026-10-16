import type { Point } from '@tabletop/common'
import { UnitType } from '@tabletop/napoleons-triumph'
import { onBattlefield } from '$lib/map/battlefield.js'
import {
    APPROACH_GEOMETRY,
    PRINTED_MARKS,
    type PrintedMark,
    type PrintedMarks
} from '$lib/map/boardGeometry.js'
import { outlinesOverlap, shortestClearSlide, type ConvexOutline } from './convexOutline.js'
import { cornersOf, type OrientedBox } from './orientedBox.js'
import { BAR_HALF_THICKNESS } from './pieceLayout.js'

// The marks keep the proportions they are printed in on the board.
export const MARK_WIDTH = 19
export const MARK_HEIGHT = 10
const MARK_GAP = 4
const TAG_PADDING = 3.5
const BAR_CLEARANCE = 1
// The bars of the map file and of the rules data are the same bars, measured to a tenth.
const SAME_BAR = 1
const CLEAR_OF_ARROWS = 1.5

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

export interface MarkRow {
    width: number
    marks: PlacedMark[]
}

export interface SymbolTag extends MarkRow {
    key: string
    angle: number
    along: Point
    /** Where its marks are printed on the board. */
    printed: OrientedBox
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

/** The marks side by side in their printed order, each placed from the left end of the row. */
export function markRow(marks: readonly PrintedMark[]): MarkRow {
    return {
        width: marks.length * MARK_WIDTH + (marks.length - 1) * MARK_GAP,
        marks: marks.map((mark, index) => ({ mark, left: index * (MARK_WIDTH + MARK_GAP) }))
    }
}

function tagOf(side: PrintedMarks): SymbolTag {
    const radians = (side.angle * Math.PI) / 180
    const along = { x: Math.cos(radians), y: Math.sin(radians) }
    const offset = { x: side.centre.x - side.bar.x, y: side.centre.y - side.bar.y }
    const reach = offset.x * along.x + offset.y * along.y
    const out = { x: offset.x - along.x * reach, y: offset.y - along.y * reach }
    const distance = Math.hypot(out.x, out.y)
    const row = markRow(side.marks)
    return {
        key: sideKey(side),
        angle: side.angle,
        along,
        printed: {
            centre: side.centre,
            along,
            halfLength: row.width / 2,
            halfWidth: MARK_HEIGHT / 2
        },
        width: row.width + TAG_PADDING * 2,
        marks: row.marks.map(({ mark, left }) => ({ mark, left: left - row.width / 2 })),
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

export function printedMarksCovered(tag: SymbolTag, arrows: readonly ConvexOutline[]): boolean {
    const printed = cornersOf(tag.printed)
    return arrows.some((arrow) => outlinesOverlap(printed, arrow))
}

export interface PlacedSymbolTag extends SymbolTag {
    centre: Point
    /** Moved along its line out from under an arrow. */
    slid: boolean
    cover: OrientedBox
}

/** Each tag beside its bar, slid along its line by as little as takes it out from under the arrows. */
export function placeSymbolTags(
    tags: readonly SymbolTag[],
    scale: number,
    arrows: readonly ConvexOutline[]
): PlacedSymbolTag[] {
    return tags.map((tag) => {
        const beside = tagCentre(tag, scale)
        const halfLength = (tag.width / 2) * scale
        const halfWidth = (TAG_HEIGHT / 2) * scale
        const clearance = CLEAR_OF_ARROWS * scale
        const slide = shortestClearSlide(
            cornersOf({
                centre: beside,
                along: tag.along,
                halfLength: halfLength + clearance,
                halfWidth: halfWidth + clearance
            }),
            arrows,
            tag.along
        )
        const centre = { x: beside.x + tag.along.x * slide, y: beside.y + tag.along.y * slide }
        return {
            ...tag,
            centre,
            slid: slide !== 0,
            cover: { centre, along: tag.along, halfLength, halfWidth }
        }
    })
}
