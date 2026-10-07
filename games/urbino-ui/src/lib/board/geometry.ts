import type { Point } from '@tabletop/common'
import { BOARD_SIZE, BuildingType, posToRowCol } from '@tabletop/urbino'

export const SQUARE_SIZE = 60
export const BOARD_MARGIN = 36
export const BOARD_PIXELS = BOARD_SIZE * SQUARE_SIZE + 2 * BOARD_MARGIN
// The board area only ever scales down, so the board is drawn large enough to fill tall windows.
export const BOARD_DISPLAY_SCALE = 1.7
export const BUILDING_FOOTPRINT = 0.7 * SQUARE_SIZE

export const BUILDING_HEIGHT: Record<BuildingType, number> = {
    [BuildingType.House]: 0.62,
    [BuildingType.Palace]: 0.92,
    [BuildingType.Tower]: 1.38
}

export const ARCHITECT_HEIGHT = 0.95

const SHADOW_DIRECTION: Point = { x: 0.55, y: 0.42 }

export function squareOrigin(pos: number): Point {
    const [row, col] = posToRowCol(pos)
    return { x: BOARD_MARGIN + col * SQUARE_SIZE, y: BOARD_MARGIN + row * SQUARE_SIZE }
}

export function squareCenter(pos: number): Point {
    const origin = squareOrigin(pos)
    return { x: origin.x + SQUARE_SIZE / 2, y: origin.y + SQUARE_SIZE / 2 }
}

export function shadowOffset(height: number): Point {
    return {
        x: SHADOW_DIRECTION.x * height * SQUARE_SIZE,
        y: SHADOW_DIRECTION.y * height * SQUARE_SIZE
    }
}

const COLUMN_LETTERS = 'ABCDEFGHI'

export function columnName(col: number): string {
    return COLUMN_LETTERS[col]
}

export function rowName(row: number): string {
    return String(row + 1)
}

export function squareName(pos: number): string {
    const [row, col] = posToRowCol(pos)
    return `${columnName(col)}${rowName(row)}`
}
