import type { Point } from '@tabletop/common'
import { STARTING_ARMIES, Side, type Face } from '@tabletop/napoleons-triumph'
import { byFaceRank } from './unitTypeOrder.js'

export interface DisplayPanel {
    x: number
    y: number
    width: number
    height: number
}

interface DisplayGrid {
    firstSlot: Point
    columnPitch: number
    rowPitch: number
    panel: DisplayPanel
}

const COLUMNS = 4

export const DISPLAY_SLOT_WIDTH = 22.5
export const DISPLAY_SLOT_HEIGHT = 116.25

// Measured on the board art; measure again if it changes.
const GRIDS: Record<Side, DisplayGrid> = {
    [Side.French]: {
        firstSlot: { x: 21, y: 629.25 },
        columnPitch: 23.5,
        rowPitch: 117.56,
        panel: { x: 19.5, y: 628.5, width: 96, height: 1057.5 }
    },
    [Side.Allied]: {
        firstSlot: { x: 2430.75, y: 693 },
        columnPitch: 23.75,
        rowPitch: 117.6,
        panel: { x: 2430, y: 691.5, width: 95.25, height: 1294.5 }
    }
}

export function displayPanel(side: Side): DisplayPanel {
    return GRIDS[side].panel
}

export function displaySlotCount(side: Side): number {
    return STARTING_ARMIES[side].length
}

/** The top left corner of a slot. The French display is printed from its top right corner, the Allied one turned about from its bottom left. */
export function displaySlot(side: Side, index: number): Point {
    const grid = GRIDS[side]
    const rows = displaySlotCount(side) / COLUMNS
    const line = Math.floor(index / COLUMNS)
    const place = index % COLUMNS
    const row = side === Side.French ? line : rows - 1 - line
    const column = side === Side.French ? COLUMNS - 1 - place : place
    return {
        x: grid.firstSlot.x + column * grid.columnPitch,
        y: grid.firstSlot.y + row * grid.rowPitch
    }
}

export function displayedFaces(armyDisplay: readonly Face[]): Face[] {
    return armyDisplay.toSorted(byFaceRank)
}
