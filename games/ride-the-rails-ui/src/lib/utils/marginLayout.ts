import type { Point } from '@tabletop/common'
import { RAILROAD_INTRODUCTIONS, type MapId, type RailroadId } from '@tabletop/ride-the-rails'
import { MARGIN_BOXES } from './boardGeometry.js'

// The margin panels' inner layout, in each panel's own units, shared by the panels that draw it
// and the flight layer that flies pieces to and from it.

export const STRIP_ROW = { top: 40, height: 63 }
export const STRIP_COLUMN = { name: 66, supply: 300, track: 406, holders: 80, holderStep: 66 }
/** How strongly the veil over a strip entry dims it until its railroad's round (R-1.4). */
export const STRIP_VEIL_OPACITY = 0.55
/** The locomotive drawn at the head of each strip entry. */
export const STRIP_LOCOMOTIVE = { x: 36, width: 44 }

export const TURN_ORDER_MARKER = { radius: 20, y: 64 }
const TURN_ORDER_SLOTS = 5
const TURN_ORDER_STEP = (MARGIN_BOXES.turnOrder.width - 32) / TURN_ORDER_SLOTS

/** The centre of a turn-order marker's disc, in the panel's units, by its 1-based position. */
export function turnOrderMarkerX(position: number): number {
    return 16 + (position - 1) * TURN_ORDER_STEP + TURN_ORDER_STEP / 2 + 8
}

/** Where a railroad's strip entry draws its locomotive, in board units (R-1.4 order). */
export function stripLocomotivePoint(mapId: MapId, railroadId: RailroadId): Point {
    const box = MARGIN_BOXES.railroadStrip
    const index = RAILROAD_INTRODUCTIONS[mapId].findIndex(
        (introduction) => introduction.railroadId === railroadId
    )
    return {
        x: box.x + STRIP_LOCOMOTIVE.x,
        y: box.y + STRIP_ROW.top + Math.max(index, 0) * STRIP_ROW.height + STRIP_ROW.height / 2
    }
}

/** The centre of a seat's turn-order marker, in board units. */
export function turnOrderMarkerPoint(turnOrder: readonly string[], playerId: string): Point {
    const box = MARGIN_BOXES.turnOrder
    const position = Math.max(turnOrder.indexOf(playerId), 0) + 1
    return { x: box.x + turnOrderMarkerX(position), y: box.y + TURN_ORDER_MARKER.y }
}

/** The round track's tickets, in the panel's units; the current one is punched. */
export const ROUND_TICKET = { width: 68, height: 46, top: 38, punch: 6 }
const ROUND_STEP = (MARGIN_BOXES.roundTrack.width - 32) / 6

/** The left edge of a round's ticket, in the panel's units. */
export function roundTicketLeft(round: number): number {
    return 16 + (round - 1) * ROUND_STEP + (ROUND_STEP - ROUND_TICKET.width) / 2
}

/** The centre of a round's ticket, in board units. */
export function roundTicketPoint(round: number): Point {
    const box = MARGIN_BOXES.roundTrack
    return {
        x: box.x + roundTicketLeft(round) + ROUND_TICKET.width / 2,
        y: box.y + ROUND_TICKET.top + ROUND_TICKET.height / 2
    }
}
