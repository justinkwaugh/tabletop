import type { AxialCoordinates } from '@tabletop/common'
import { BOARD_RADIUS, isSpace } from './geometry.js'

const COLUMNS = 'ABCDEFGHI'

function bottomOfColumn(q: number): number {
    return Math.min(BOARD_RADIUS, BOARD_RADIUS - q)
}

// Rulebook notation: columns A–I left to right, each counted up from 1 at its bottom point;
// column E skips the centre, so it runs E1–E4 below it and E5–E8 above.
export function spaceName(coords: AxialCoordinates): string {
    const aboveCentre = coords.q === 0 && coords.r < 0 ? 1 : 0
    const number = bottomOfColumn(coords.q) - coords.r + 1 - aboveCentre
    return `${COLUMNS[coords.q + BOARD_RADIUS]}${number}`
}

export function spaceFromName(name: string): AxialCoordinates {
    const q = COLUMNS.indexOf(name[0].toUpperCase()) - BOARD_RADIUS
    const number = Number(name.slice(1))
    const skipsCentre = q === 0 && number > BOARD_RADIUS ? 1 : 0
    const coords = { q, r: bottomOfColumn(q) + 1 - number - skipsCentre }
    if (!isSpace(coords)) {
        throw Error(`No space ${name}`)
    }
    return coords
}
