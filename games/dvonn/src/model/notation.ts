import type { AxialCoordinates } from '@tabletop/common'
import { isSpace, MIDDLE_ROW_LENGTH, ROWS } from './geometry.js'

const COLUMNS = 'ABCDEFGHIJK'
const COLUMN_REACH = (MIDDLE_ROW_LENGTH - 1) / 2
const ROW_REACH = (ROWS - 1) / 2

// Rows 1–5 rise from the bottom; letters run along each row and stay level up the diagonals
// leaning left, so row 1 runs A1–I1, the middle row A3–K3 and the top row C5–K5.
export function spaceName(coords: AxialCoordinates): string {
    return `${COLUMNS[coords.q + COLUMN_REACH]}${ROW_REACH + 1 - coords.r}`
}

export function spaceFromName(name: string): AxialCoordinates {
    const coords = {
        q: COLUMNS.indexOf(name[0].toUpperCase()) - COLUMN_REACH,
        r: ROW_REACH + 1 - Number(name.slice(1))
    }
    if (!isSpace(coords)) {
        throw Error(`No space ${name}`)
    }
    return coords
}
