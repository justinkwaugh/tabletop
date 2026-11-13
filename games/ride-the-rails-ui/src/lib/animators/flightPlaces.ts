import type { Point } from '@tabletop/common'
import type { MapId, RailroadId } from '@tabletop/ride-the-rails'
import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/utils/boardGeometry.js'
import { stripLocomotivePoint, turnOrderMarkerPoint } from '$lib/utils/marginLayout.js'
import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
import { moneyKey, seatCardKey, supplyKey } from './flights.svelte.js'

/** The board's own SVG, found by this attribute. */
export const BOARD_ATTRIBUTE = 'data-map-board'

/** The attribute that marks what a phone's flight lifts from or lands on, by the flight key. */
export const FLIGHT_TARGET_ATTRIBUTE = 'data-flight-target'

/**
 * The smallest a coin or a share's locomotive is drawn on a phone, in pixels a board unit: the
 * whole map draws a board unit at about a fifth of a pixel, where a coin is a dot.
 */
export const READABLE_SCALE = 0.8

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
    const width =
        Math.min(box.left + box.width, view.left + view.width) - Math.max(box.left, view.left)
    const height =
        Math.min(box.top + box.height, view.top + view.height) - Math.max(box.top, view.top)
    if (width <= 0 || height <= 0 || box.width <= 0 || box.height <= 0) return 0
    return (width * height) / (box.width * box.height)
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

/** The board's frame on screen, read from its SVG. */
export function boardFrame(document: Document): BoardFrame | undefined {
    const box = document.querySelector(`svg[${BOARD_ATTRIBUTE}]`)?.getBoundingClientRect()
    if (!box || box.width === 0 || box.height === 0) return undefined
    return {
        left: box.left,
        top: box.top,
        scaleX: box.width / BOARD_WIDTH,
        scaleY: box.height / BOARD_HEIGHT
    }
}

/**
 * Contract, Phone layout: phones leave the board's margin panels out and show the railroad strip
 * above the board and the money on the seat cards and the waiting view instead. On a phone a
 * flight goes to the element marked with its key, in board units; elsewhere there is none.
 */
export function phonePlace(key: string): Point | undefined {
    if (!isPhoneWidth() || typeof document === 'undefined') return undefined
    const frame = boardFrame(document)
    if (!frame) return undefined
    const boxes = [...document.querySelectorAll(`[${FLIGHT_TARGET_ATTRIBUTE}="${key}"]`)]
        .map((element) => element.getBoundingClientRect())
        .filter((box) => box.width > 0 && box.height > 0)
    const view = {
        left: 0,
        top: 0,
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight
    }
    const landing = landingPoint(boxes, view)
    return landing ? toBoard(frame, landing) : undefined
}

/** Where a railroad's locomotives lift from: its strip entry, in the margin or above the board. */
export function railroadSourcePoint(mapId: MapId, railroadId: RailroadId): Point {
    return phonePlace(supplyKey(railroadId)) ?? stripLocomotivePoint(mapId, railroadId)
}

/** Where a seat's shares and money land: its turn-order marker, or its money on a phone. */
export function seatMoneyPoint(turnOrder: readonly string[], playerId: string): Point {
    return phonePlace(moneyKey(playerId)) ?? turnOrderMarkerPoint(turnOrder, playerId)
}

/** Where a seat's new share lands: its turn-order marker, or its seat card on a phone. */
export function seatCardPoint(turnOrder: readonly string[], playerId: string): Point {
    return phonePlace(seatCardKey(playerId)) ?? turnOrderMarkerPoint(turnOrder, playerId)
}
