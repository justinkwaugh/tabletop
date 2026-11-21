import { LOCOMOTIVES, type LocomotiveId } from '@tabletop/locomotive-werks'

// The board after the tabloid map: a title banner, frozen above one row per locomotive, which
// scroll beneath it. Existing Orders sit on the left and the Customer Base, a single stack of
// dice, on the right. Both are drawn at the window's width.
export const HEADER_HEIGHT = 118
export const ROW_HEIGHT = 74
export const BOARD_MARGIN = 10
export const ROWS_HEIGHT = LOCOMOTIVES.length * ROW_HEIGHT + BOARD_MARGIN

export const STRIPE_WIDTH = 28
export const BOX = 56
export const BOX_STEP = 64
export const DIE = 50
export const EDGE = 40

export const NUMERAL = { x: 390, width: 48 }
export const CARDS_X = 452
export const COSTS_X = 494
export const COSTS_WIDTH = 150
export const INITIAL_X = 660
// Each seat has its own column, so a player's werks line up down the board.
export const WORKS = { x: 734, width: 58, height: 54, step: 64, columns: 5 }
export const CUSTOMER_BASE_X = WORKS.x + WORKS.columns * WORKS.step + 10
// The stack's dice count sits beside it.
export const STACK_COUNT_X = CUSTOMER_BASE_X + BOX + 8
export const BOARD_WIDTH = STACK_COUNT_X + 34 + STRIPE_WIDTH

export function rowTop(index: number): number {
    return index * ROW_HEIGHT
}

export function rowIndex(locomotiveId: LocomotiveId): number {
    return LOCOMOTIVES.findIndex((locomotive) => locomotive.id === locomotiveId)
}

export function existingOrderBox(slot: number): number {
    return EDGE + slot * BOX_STEP
}

// Alphabetic baselines with a measured shift centre text in every browser.
export function centredBaseline(centreY: number, fontSize: number): number {
    return centreY + fontSize * 0.35
}
