import type { Point } from '@tabletop/common'
import { visualClientRect } from '@tabletop/frontend-components'
import type { RailroadId } from '@tabletop/ride-the-rails'
import type { BoardGeometry } from '$lib/utils/boardGeometry.js'
import { findInTable, viewOf } from '$lib/utils/tableScope.js'
import {
    CONNECTION_KEY,
    TRANSCONTINENTAL_KEY,
    moneyKey,
    seatCardKey,
    shareSlotKey,
    supplyKey,
    type Flyer
} from './flights.svelte.js'

/** The flyers that never leave the map: drawn only where the board shows. */
const MAP_FLYERS: ReadonlySet<Flyer['kind']> = new Set(['outline', 'line', 'passenger', 'pulse'])

export function onTheMap(flyer: Flyer): boolean {
    return MAP_FLYERS.has(flyer.kind)
}

/** A locomotive lifting from its supply pile, as wide as a map cube's largest slot, in board units. */
export const TRAVELLING_LOCOMOTIVE_WIDTH = 40

/** The board's own SVG, found by this attribute. */
const BOARD_ATTRIBUTE = 'data-map-board'

/** The attribute that marks what a phone's flight lifts from or lands on, by the flight key. */
const FLIGHT_TARGET_ATTRIBUTE = 'data-flight-target'

/**
 * The smallest a coin or a share's locomotive is drawn on a phone, in pixels a board unit: the
 * whole map draws a board unit at about a fifth of a pixel, where a coin is a dot.
 */
const READABLE_SCALE = 0.8

/** How much a phone enlarges a coin or a share's locomotive on a board drawn at `frame`. */
export function readableBoost(frame: BoardFrame): number {
    return Math.max(1, READABLE_SCALE / frame.scaleX)
}

/** How the board is drawn on screen now: where its corner is and its pixels per board unit. */
export type BoardFrame = { left: number; top: number; scaleX: number; scaleY: number }

export type ScreenBox = { left: number; top: number; width: number; height: number }

/** The space kept between a flight's landing point and the edge of the view, in pixels. */
const LANDING_MARGIN = 12

export function toBoard(frame: BoardFrame, screen: Point): Point {
    return { x: (screen.x - frame.left) / frame.scaleX, y: (screen.y - frame.top) / frame.scaleY }
}

export function toScreen(frame: BoardFrame, board: Point): Point {
    return { x: frame.left + board.x * frame.scaleX, y: frame.top + board.y * frame.scaleY }
}

/** The board-to-screen transform of a frame, for an SVG `transform` attribute. */
export function frameTransform(frame: BoardFrame): string {
    return `matrix(${frame.scaleX} 0 0 ${frame.scaleY} ${frame.left} ${frame.top})`
}

function visiblePart(box: ScreenBox, view: ScreenBox): ScreenBox {
    const left = Math.max(box.left, view.left)
    const top = Math.max(box.top, view.top)
    const right = Math.min(box.left + box.width, view.left + view.width)
    const bottom = Math.min(box.top + box.height, view.top + view.height)
    return { left, top, width: right - left, height: bottom - top }
}

function visibleShare(box: ScreenBox, view: ScreenBox): number {
    const part = visiblePart(box, view)
    if (part.width <= 0 || part.height <= 0 || box.width <= 0 || box.height <= 0) return 0
    return (part.width * part.height) / (box.width * box.height)
}

/**
 * Contract, Phone layout: where on screen a flight lands among the places that show its target
 * (a seat's money shows on its seat card and, while waiting, in the action area): the centre of
 * what the view shows of the one most in view, or, when none is in view, its centre brought just
 * inside the view's edge.
 */
export function landingPoint(boxes: readonly ScreenBox[], view: ScreenBox): Point | undefined {
    const ranked = [...boxes].sort((a, b) => visibleShare(b, view) - visibleShare(a, view))
    const whole = ranked[0]
    if (!whole) return undefined
    const box = visibleShare(whole, view) > 0 ? visiblePart(whole, view) : whole
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
    return {
        x: clamp(
            box.left + box.width / 2,
            view.left + LANDING_MARGIN,
            view.left + view.width - LANDING_MARGIN
        ),
        y: clamp(
            box.top + box.height / 2,
            view.top + LANDING_MARGIN,
            view.top + view.height - LANDING_MARGIN
        )
    }
}

/** The board's SVG in the title's table; none while the board is not drawn. */
export function boardIn(table: Element | undefined): Element | undefined {
    return findInTable(table, `svg[${BOARD_ATTRIBUTE}]`)
}

/**
 * Where the board is drawn on screen. The board lies inside its view's CSS zoom, whose boxes
 * Safari 26.0 and older report divided by the zoom, so it is measured as drawn
 * (`docs/phone-rendering.md`, Measuring under zoom).
 */
export function boardBoxOf(board: Element): ScreenBox {
    return visualClientRect(board)
}

/** The board's frame from its box on screen; none while the board is not drawn. */
export function frameOf(board: BoardGeometry, box: ScreenBox): BoardFrame | undefined {
    if (box.width === 0 || box.height === 0) return undefined
    return {
        left: box.left,
        top: box.top,
        scaleX: box.width / board.width,
        scaleY: box.height / board.height
    }
}

/**
 * Where a flight lifts from when nothing on the table shows its railroad's pile (the table is not
 * drawn): the middle of the board's top edge, where the railroad cards stand.
 */
export function aboveTheBoard(board: BoardGeometry): Point {
    return { x: board.width / 2, y: 0 }
}

/**
 * Where a seat's flight lands when nothing on the table shows its card or money (the History tab
 * is open or the side panel is folded): the board's edge beside the side panel.
 */
export function besideTheSidePanel(board: BoardGeometry): Point {
    return { x: 0, y: board.height / 2 }
}

/**
 * Contract, Animation plan: the board holds only the map, so a flight goes to the element on the
 * table marked with its key (a railroad's pile, a seat's card or money, the Transcontinental chip),
 * in board units; none while the board or the element is not drawn.
 */
function tablePlace(
    board: BoardGeometry,
    table: Element | undefined,
    key: string
): Point | undefined {
    const drawn = boardIn(table)
    const frame = drawn && frameOf(board, boardBoxOf(drawn))
    if (!table || !frame) return undefined
    const boxes = [...table.querySelectorAll(`[${FLIGHT_TARGET_ATTRIBUTE}="${key}"]`)]
        .map((element) => visualClientRect(element))
        .filter((box) => box.width > 0 && box.height > 0)
    const landing = landingPoint(boxes, viewOf(drawn))
    return landing ? toBoard(frame, landing) : undefined
}

/**
 * Where a railroad's locomotives lift from: its supply pile, on its card, or on a phone the share
 * button's or the build panel's pile.
 */
export function railroadSourcePoint(
    board: BoardGeometry,
    table: Element | undefined,
    railroadId: RailroadId
): Point {
    return tablePlace(board, table, supplyKey(railroadId)) ?? aboveTheBoard(board)
}

/** Where a seat's coins land: its money, on its seat card or in the waiting view. */
export function seatMoneyPoint(
    board: BoardGeometry,
    table: Element | undefined,
    playerId: string
): Point {
    return tablePlace(board, table, moneyKey(playerId)) ?? besideTheSidePanel(board)
}

/** Where a seat's new share lands: the slot it fills on the seat card, or the card itself. */
export function seatCardPoint(
    board: BoardGeometry,
    table: Element | undefined,
    playerId: string,
    slot?: number
): Point {
    return (
        (slot === undefined ? undefined : tablePlace(board, table, shareSlotKey(playerId, slot))) ??
        tablePlace(board, table, seatCardKey(playerId)) ??
        besideTheSidePanel(board)
    )
}

/** Where the Transcontinental's coin lands: the chip in the turn line. */
export function transcontinentalPoint(board: BoardGeometry, table: Element | undefined): Point {
    return tablePlace(board, table, TRANSCONTINENTAL_KEY) ?? aboveTheBoard(board)
}

/** R-8: where a connection bonus's coin lands, its chip in the turn line. */
export function connectionPoint(board: BoardGeometry, table: Element | undefined): Point {
    return tablePlace(board, table, CONNECTION_KEY) ?? aboveTheBoard(board)
}
